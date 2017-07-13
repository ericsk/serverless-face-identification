let req = require('request');

const FACE_API_KEY = '';
const PERSON_GROUP_ENDPOINT = '';
const PERSON_GROUP_ID = '';
const PERSON_GROUP_NAME = '';

module.exports = function (context, person) {
    let personTable = context.bindings.personTable = [];

    let pgId, pId;

    // check if the person group has been created.
    ensurePersonGroup(context)
        .then((personGroupId)=>{
            pgId = personGroupId;
            return ensurePerson(context, personGroupId, person);
        })
        .then((personId) => {
            pId = personId;

            let addingFaces = [];
            person.faceImages.forEach(faceImage => {
                addingFaces.push(addingPersonFace(context, pgId, pId, faceImage));
            });

            return Promise.all(addingFaces);
        })
        .then(() => {
            context.log('[Final] Training person group...');
            req({
                url: `${PERSON_GROUP_ENDPOINT}/${pgId}/train`,
                method: 'POST',
                headers: {
                    'Ocp-Apim-Subscription-Key': FACE_API_KEY
                }
            }, (e, r, b) => {
                context.log('Done.')
                context.done(); 
            });
        });
};


/**
 * Ensure the person group is created.
 * 
 * @param object context
 */
function ensurePersonGroup(context) {
    context.log('[PersonGroup] Check if the person group is created...');

    return new Promise((resolve, reject) => {
        req({
            url: `${PERSON_GROUP_ENDPOINT}/${PERSON_GROUP_ID}`,
            method: 'GET',
            headers: {
                'Ocp-Apim-Subscription-Key': FACE_API_KEY
            },
            json: true
        }, (err, response, body) => {
            if (body.error) {
                context.log('[PersonGroup] Person group does not exist.');
                req({
                    url: `${PERSON_GROUP_ENDPOINT}/${PERSON_GROUP_ID}`,
                    method: 'PUT',
                    body: {
                        "name": PERSON_GROUP_NAME
                    },
                    headers: {
                        'Content-Type': 'application/json',
                        'Ocp-Apim-Subscription-Key': FACE_API_KEY
                    },
                    json: true
                }, () => {
                    resolve(PERSON_GROUP_ID);
                })
            } else {
                context.log('[PersonGroup] Person group existed.');

                resolve(PERSON_GROUP_ID);
            }
        });
    });
}

/**
 * Create a new Person on Face API.
 * 
 * @param context
 * @param string name The name of the person.
 * @param object data The metadata of the person.
 * @return string The created Person Id.
 */
function ensurePerson(context, personGroupId, person) {
    return new Promise((resolve, reject) => {
        context.log('[Person] Check if the person existed...');

        // get
        let result = context.bindings.personEntity.find((element) => element.RowKey == person.name);
        if (result !== undefined) {
            context.log(`[Person] Person ${result.PersonId} existed`);
            resolve(result.PersonId);
        } else {
            context.log(`[Person] Creating new person...`);
            req({
                url: `${PERSON_GROUP_ENDPOINT}/${personGroupId}/persons`,
                method: 'POST',
                json: true,
                headers: {
                    'Content-Type': 'application/json',
                    'Ocp-Apim-Subscription-Key': FACE_API_KEY
                },
                body: {
                    'name': person.name,
                    'userData': JSON.stringify(person.data)
                }
            }, (e, r, b) => {
                // write back to table storage
                context.log(`[Person] New person ${b.personId} has been created...`);

                context.bindings.personTable.push({
                    'PartitionKey': 'LearnedFace',
                    'RowKey': person.name,
                    'PersonId': b.personId
                });
                resolve(b.personId);
            });
        }
    });
}

/**
 * Add faces to a specified person.
 * 
 * @param object context
 * @param string personId
 * @return
 */
function addingPersonFace(context, personGroupId, personId, faceImageUrl) {
    return new Promise((resolve, reject) => {
        context.log('[AddingPersonFace] Adding person face...');

        req({
            url: `${PERSON_GROUP_ENDPOINT}/${personGroupId}/persons/${personId}/persistedFaces`,
            method: 'POST',
            json: true,
            headers: {
                'Content-Type': 'application/json',
                'Ocp-Apim-Subscription-Key': FACE_API_KEY
            },
            body: {
                'url': faceImageUrl
            }
        }, (e, r, b) => {
            context.log(`[AddingPersonFace] Added face ${b.persistedFaceId}...`);
            resolve(b.persistedFaceId);
        });
    });
}
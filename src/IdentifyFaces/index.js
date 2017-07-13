const req = require('request');

const FACE_API_KEY = '';
const FACE_API_ENDPOINT = '';
const FACE_PERSON_GROUP_ID = '';

module.exports = function (context, image) {
    context.bindings.outputTable = [];

    getFaceId(context, image)
        .then((faceId) => {
            return identifyFace(context, faceId);
        })
        .then((personId) => {
            return getPerson(context, personId);
        })
        .then((name, data) => {
            context.bindings.outputTable.push({
                'PartitionKey': 'IdentifiedFace',
                'RowKey': name,
                'UserData': data
            });

            context.log("Done.");
            context.done();
        });
};

function getFaceId(context, image) {
    return new Promise((resolve, reject) => {
        context.log("[GETFACEID] Getting face ID...");
        req({
            url: `${FACE_API_ENDPOINT}/detect?returnFaceId=true&returnFaceLandmarks=false`,
            method: 'POST',
            body: image,
            headers: {
                'Content-Type': 'application/octet-stream',
                'Ocp-Apim-Subscription-Key': FACE_API_KEY
            }
        }, (err, res, body) => {
            let faces = JSON.parse(body);
            context.log(`[GETFACEID] The Face ID is ${faces[0].faceId}`);
            resolve(faces[0].faceId);
        });
    });
}

function identifyFace(context, faceId) {
    return new Promise((resolve, reject) => {
        context.log("[IDENTIFY] Identifying face....");
        req({
            url: `${FACE_API_ENDPOINT}/identify`,
            method: 'POST',
            json: true,
            headers: {
                'Content-Type': 'application/json',
                'Ocp-Apim-Subscription-Key': FACE_API_KEY
            },
            body: {
                'personGroupId': FACE_PERSON_GROUP_ID,
                'faceIds': [faceId],
                'maxNumOfCandidatesReturned':1,
                'confidenceThreshold': 0.5
            }
        }, (e, r, b) => {
            context.log(`[IDENTIFY] Identified person: ${b[0].candidtes[0].personId}`);
            resolve(b[0].candidtes[0].personId);
        });
    });
}

function getPerson(context, personId) {
    return new Promise((resolve, reject) => {
        req({
            url: `${FACE_API_ENDPOINT}/persongroups/${FACE_PERSON_GROUP_ID}/persons/${personId}`,
            method: 'GET',
            json: true,
            headers: {
                'Content-Type': 'application/json',
                'Ocp-Apim-Subscription-Key': FACE_API_KEY
            }
        }, (e, r, b) => {
            context.log(`[GET PERSON] Got person ${b.name}`);
            resolve(b.name, b.userData);
        });
    });
}
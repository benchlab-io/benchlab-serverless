const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);
// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
exports.triggerV1 = functions.https.onRequest((request, response) => {
    var data = request.body
    var db = admin.firestore();

    var projects = db.collection('projects');
    var jobs = db.collection('jobs');
    projects.where('name', '==', data.repository.full_name).get()
        .then(snapshot => {
            if (snapshot.empty) {
                console.log('No matching documents.');
                return;
            }
            var g = null
            snapshot.forEach(doc => {
                g = doc.data();
            });


            var job = {
                project: data.repository.full_name,
                owner_uid: g.owner_uid,
                branch: data.ref.split('/')[2],
                commit: { ...data.head_commit },
                compare: data.compare,
                status: 'waiting',
                clone_url: data.repository.clone_url,
                creation_time: admin.firestore.FieldValue.serverTimestamp()
            }
            jobs.add(job)
        })
        .catch(err => {
            console.log('Error getting documents', err);
        });
    response.send();
});

exports.jobV1 = functions.https.onRequest((request, response) => {
    var db = admin.firestore();
    switch (request.method) {
        case 'GET': {

            var jobs = db.collection('jobs');
            jobs.where('status', '==', 'waiting').get()
                .then(snapshot => {
                    if (snapshot.empty) {
                        response.send({ "jobs": [] })
                        return;
                    }
                    var jRes = []
                    snapshot.forEach(doc => {
                        var jRef = jobs.doc(doc.id)
                        db.runTransaction(t => {
                            return t.get(jRef)
                                .then(doc => {
                                    t.update(jRef, { status: 'dispatched' });
                                });
                        }).then(result => {
                            jRes.push({ ...doc.data(), job_id: doc.id })
                            response.send({ "jobs": jRes })
                            return
                        }).catch(err => {
                            console.log('Transaction failure:', err);
                        });

                    })
                })
            break
        }
        case 'PUT': {
            if (request.body.status) {
                var jobs = db.collection('jobs');
                var jRef = jobs.doc(request.body.job_id);
                jRef.update({ status: request.body.status })
                response.send()
                return
            }
            if (request.body.logs) {
                var logs = db.collection('logs');
                var jobs = db.collection('jobs');
                var jRef = jobs.doc(request.body.job_id)

                var j = jRef.get().then((doc) => {
                    request.body.logs.forEach(log => {
                        logs.add({ ...log, creation_time: admin.firestore.FieldValue.serverTimestamp(), job_id: request.body.job_id, owner_uid: doc.data().owner_uid })
                    })
                    response.send()
                    return
                });


            }

        }
    }
});
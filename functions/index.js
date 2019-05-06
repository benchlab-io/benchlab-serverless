const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { K8S } = require('./misc/k8s');
const { GCP } = require('./misc/gcp');
const { GetOne, GetMulti, Getuid } = require('./misc/fireUtil');



admin.initializeApp(functions.config().firebase);
var db = admin.firestore();


exports.triggerV1 = functions.https.onRequest((request, response) => {
    var data = request.body
    var projects = db.collection('projects');
    var jobs = db.collection('jobs');
    var snap = projects.where('name', '==', data.repository.full_name).get()
    if (snap.empty) {
        console.log('No matching documents.');
        return;
    }
    var g = GetOne(snapshot)
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
    response.send();
});



exports.jobV1 = functions.https.onRequest(async (request, response) => {
    switch (request.method) {
        case 'GET': {
            var jobs = db.collection('jobs');
            var snapshot = await jobs.where('status', '==', 'waiting').limit(1).get()
            if (snapshot.empty) {
                response.send({ "jobs": [] })
                return;
            }
            var jRes = []
            try {
                var doc = GetOne(snapshot);
                var jRef = jobs.doc(doc.id);
                db.runTransaction(async (t) => {
                    var doc = await t.get(jRef)
                    await t.update(jRef, { status: 'dispatched' });
                    var settings = db.collection('settings');
                    var job = doc.data()
                    var snap = await settings.where('owner_uid', '==', job.owner_uid).get()
                    var settings = GetOne(snap)
                    jRes.push({ ...job, job_id: doc.id, sa: settings.SA, gcloud_project: JSON.parse(settings.SA).project_id })
                    response.send({ "jobs": jRes })
                })
                return

            } catch (err) {
                console.log(err)
                return
            }
        }
        case 'PUT': {
            if (request.body.status) {
                var jobs = db.collection('jobs');
                var jRef = jobs.doc(request.body.job_id);
                jRef.update({ status: request.body.status })
                if (request.body.status == "success") {
                    var jt = await jRef.get()
                    var j = jt.data()
                    var settings = db.collection('settings');
                    var snap = await settings.where('owner_uid', '==', j.owner_uid).get()
                    var settings = GetOne(snap)
                    settings.SA = JSON.parse(settings.SA)
                    var k8 = new K8S(settings.cluster)
                    await k8.init()
                    await k8.deploy(settings.SA.project_id, j.project, jRef.id)

                }
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


exports.initV1 = functions.https.onCall(async (data, context) => {
    var uid = null
    if(process.env.DEV_FIREBASE){
        uid =  data.uid
    } else {
        uid = context.auth.uid;
    }
    var settings = db.collection('settings');
    var snap = await settings.where('owner_uid', '==', uid).get()
    var settings = GetOne(snap)
    var cloud = new GCP(JSON.parse(settings.SA))
    try {
        var cluster = await cloud.CreateCluster()
        db.collection("settings").doc(settings.id).update({
            cluster: cluster
        });
        return
    } catch (err) {
        console.log(err)
        return
    }

});

exports.ingressV1 = functions.https.onCall(async (data, context) => {
    var uid = Getuid(data,context)
    const projects = db.collection('projects');
    var snap = await projects.where('owner_uid', '==', uid).get()
    var p = GetMulti(snap).filter((i)=> i.hostname)
    const settings = db.collection('settings');
    snap = await settings.where('owner_uid', '==', uid).get()
    var s = GetOne(snap)
    s.SA = JSON.parse(s.SA)
    var k8 = new K8S(s.cluster)
    await k8.init()
    k8.ingress(p.map(i => {return {host: i.hostname , service: i.name.split('/')[1] }}))
    return
});


exports.podInfoV1 =  functions.https.onCall(async (data, context) => {
    var uid = Getuid(data,context)
    const projects = db.collection('projects');
    var snap = await projects.doc(data.project).get()
    var p = snap.data()
    const settings = db.collection('settings');
    snap = await settings.where('owner_uid', '==', uid).get()
    var s = GetOne(snap)
    var k8 = new K8S(s.cluster)
    await k8.init()
    return await k8.getStatus(p.name)
})
exports.monitoringV1 =  functions.https.onCall(async (data, context) => {
    var uid = Getuid(data,context)
    const projects = db.collection('projects');
    var snap = await projects.doc(data.project).get()
    var p = snap.data()
    const settings = db.collection('settings');
    snap = await settings.where('owner_uid', '==', uid).get()
    var s = GetOne(snap)
    var cloud = new GCP(JSON.parse(s.SA))
    var res =  await cloud.GetMetrics()
    return res.body

})

exports.secretListV1 = functions.https.onCall(async (data, context) => {
    var uid = Getuid(data,context)
    const settings = db.collection('settings');
    snap = await settings.where('owner_uid', '==', uid).get()
    var s = GetOne(snap)
    var k8 = new K8S(s.cluster)

    await k8.init()
    return await k8.listSecret()
})
exports.secretListV1 = functions.https.onCall(async (data, context) => {
    var uid = Getuid(data,context)
    const settings = db.collection('settings');
    snap = await settings.where('owner_uid', '==', uid).get()
    var s = GetOne(snap)
    var k8 = new K8S(s.cluster)
    
    await k8.init()
    return await k8.listSecret()
})
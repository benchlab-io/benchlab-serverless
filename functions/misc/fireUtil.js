const { K8S } = require('./k8s');


function GetOne(snap) {
    console.log(snap.size)
    if (snap.size != 1) {
        return null
    }
    var res = null
    snap.forEach((doc) => {
        res = { ...doc.data(), id: doc.id }
    })
    return res
}

function GetMulti(snap) {

    var res = []
    snap.forEach((doc) => {
        res.push({ ...doc.data(), id: doc.id })
    })
    return res
}

function GetUid(data, context) {
    var uid = null
    if (process.env.DEV_FIREBASE) {
        uid = data.uid
    } else {
        uid = context.auth.uid;
    }
    return uid
}

async function GetClusterByUid(uid, db) {
    const settings = db.collection('settings');
    snap = await settings.where('owner_uid', '==', uid).get()
    var s = GetOne(snap)
    var k8 = new K8S(s.cluster)

    await k8.init()

    return k8
}

module.exports = {
    GetOne,
    GetMulti,
    GetUid,
    GetClusterByUid
}
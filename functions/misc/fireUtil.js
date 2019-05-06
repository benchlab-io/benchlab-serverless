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

function Getuid(data, context) {
    var uid = null
    if (process.env.DEV_FIREBASE) {
        uid = data.uid
    } else {
        uid = context.auth.uid;
    }
    return uid
}


module.exports = {
    GetOne,
    GetMulti,
    Getuid,
}
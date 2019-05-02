function GetOne(snap) {
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




module.exports = {
    GetOne,
    GetMulti
}
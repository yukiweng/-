const crypto=require('crypto')

function md5(s){
    return crypto.createHash('md5').update(String(s)).digest('hex')
}

function isObject(obj) {
    return typeof obj === 'object' && obj instanceof Array ===false
}

module.exports={md5, isObject}

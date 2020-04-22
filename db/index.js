const mysql = require('mysql')
const { host,user,password,database } = require('./config')
const { debug } = require('../utils/constant')
const { isObject } = require('../utils/index')

function connect(){
    return mysql.createConnection({
        host,
        user,
        password,
        database,
        multipleStatements:true
    })
}

function querySql(sql) {
    const conn = connect()
    return new Promise((resolve, reject) => {
        try {
            conn.query(sql, (err, results) => {
                if (err) {
                    debug && console.log('查询失败，原因',JSON.stringify(err))
                    reject(err)
                } else {
                    debug && console.log('查询成功',JSON.stringify(results))
                    resolve(results)
                }
            })
        } catch (err) {
            reject(err)
        } finally {
            conn.end()
        }
    })
}

function queryOne(sql){
    return new Promise((resolve,reject) =>{
        querySql(sql).then(results=>{
            if(results&&results.length>0){
                resolve(results[0])
            }else{
                resolve(null)
            }
        }).catch(err=>{
            reject(err)
        })
    } )
}

function insert(model, tableName) {
    return new Promise((resolve, reject) => {
        if (!isObject(model)) {
            reject(new Error('插入数据库失败，插入数据非对象'))
        } else {
            const keys = []
            const values = []
            Object.keys(model).forEach(key => {
                if (model.hasOwnProperty(key)) { // model自身拥有该key，而非原型链上的
                    keys.push(`\`${key}\``)
                    values.push(`'${model[key]}'`)
                }
            })
            if (keys.length > 0 && values.length > 0) {
                let sql = `INSERT INTO \`${tableName}\` (`
                const keyString = keys.join(',')
                const valuesString = values.join(',')
                sql = `${sql}${keyString}) VALUES (${valuesString})`
                const conn = connect()
                try {
                    conn.query(sql, (err, result) => {
                        if (err) {
                            reject(err)
                        } else {
                            resolve(result)
                        }
                    })
                } catch (e) {
                    reject(e)
                } finally {
                    conn.end()
                }
            }
        }
    })
}

function update(model, tableName, where) {
    return new Promise((resolve, reject) => {
        if (!isObject(model)) {
            reject(new Error('插入数据库失败，插入数据非对象'))
        } else {
            const entry = []
            Object.keys(model).forEach(key => {
                if (model.hasOwnProperty(key)) {
                    entry.push(`\`${key}\`='${model[key]}'`)
                }
            })
            if (entry.length > 0) {
                let sql = `UPDATE \`${tableName}\` SET`
                sql = `${sql} ${entry.join(',')} ${where}`
                const conn = connect()
                try {
                    conn.query(sql, (err, result) => {
                        if (err) {
                            reject(err)
                        } else {
                            resolve(result)
                        }
                    })
                } catch (e) {
                    reject(e)
                } finally {
                    conn.end()
                }
            }
        }
    })
}

function and(where, key, value) {
    if (where === 'where') {
        return `${where} \`${key}\`='${value}'`
    } else {
        return `${where} and \`${key}\`='${value}'`
    }
}

function andLike(where, key, value) {
    if (where === 'where') {
        return `${where} \`${key}\` like '%${value}%'`
    } else {
        return `${where} and \`${key}\` like '%${value}%'`
    }
}

module.exports={querySql, queryOne, insert, update, and, andLike}

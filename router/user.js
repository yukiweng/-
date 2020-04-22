const express = require('express')
const router = express.Router()
const Result = require('../models/Result')
const { login,findUser } = require('../service/user')
const { PWD_SALT } = require('../utils/constant')
const { md5 } = require('../utils/index')
const { body, validationResult } = require('express-validator')
const boom = require('boom')
const jwt = require('jsonwebtoken')
const { PRIVATE_KEY, JWT_EXPIRED, REFRESH_JWT_EXPIRED } = require('../utils/constant')


router.get('/info', function (req, res, next) {
    if(req.user && req.user.username){
        findUser(req.user.username).then(user=>{
            if(user){
                user.roles = [user.role]
                new Result(user,'用户信息查询成功').success(res)
            }else{
                new Result('用户信息查询失败').fail(res)
            }
        })
    }
})

router.post(
    '/login',
    [
        body('username').isString().withMessage('用户名必须为字符'),
        body('password').isNumeric().withMessage('密码必须为数字')
    ],
    function (req, res, next) {
        const err = validationResult(req)
        if(!err.isEmpty()){
            const [{ msg }] = err.errors
            next(boom.badRequest(msg))
        }else{
            let { username, password } = req.body
            password = md5(`${password}${PWD_SALT}`)
            login(username,password).then(user=>{
                if(!user || user.length === 0){
                    new Result('登录失败').fail(res)
                }else{
                    const token = jwt.sign(
                        { username },
                        PRIVATE_KEY,
                        { expiresIn:JWT_EXPIRED }
                    )
                    const refreshToken = jwt.sign(
                        { username },
                        PRIVATE_KEY,
                        { expiresIn:REFRESH_JWT_EXPIRED }
                    )
                    new Result({ token, refreshToken },'登录成功').success(res)
                }
            })
        }
    }
)


module.exports=router

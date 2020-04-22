const express = require('express')
const boom = require('boom')
const userRouter = require('./user')
const bookRouter = require('./book')
const jwtAuth = require('./jwt')
const Result = require('../models/Result')
const refreshJwt = require('./refreshJwt')


const router = express.Router()
router.use(jwtAuth)

router.use('/user',userRouter)
router.use('/book',bookRouter)
router.use(refreshJwt)
router.get('/',function (req, res) {
    res.send('读书管理')
})
router.use((req, res, next)=>{
    next(boom.notFound('接口不存在'))
})

router.use((err,req,res,next)=>{
    if(err.name === 'UnauthorizedError'){
        const { status = 401,message }=err
        new Result(null,'Token验证失败',{
            error:status,
            errorMsg:message
        }).jwtError(res.status(status))
    }else{
        const msg = (err&&err.message) || '系统错误'
        const statusCode = (err.output && err.output.statusCode) || 500
        const errorMsg = (err.output && err.output.payload && err.output.payload.error) || err.message
        new Result(null,msg,{
            error: statusCode,
            errorMsg
        }).fail(res.status(statusCode))
    }
})

module.exports = router

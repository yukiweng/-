const express = require('express')
const Result = require('../models/Result')
const jwt = require('jsonwebtoken')
const { PRIVATE_KEY, JWT_EXPIRED, REFRESH_JWT_EXPIRED } = require('../utils/constant')


const router = express.Router()

router.post(
    '/refresh',
    function (req, res, next) {
        console.log(req.user.username);
        const username = req.user.username
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
        new Result({ token, refreshToken },'刷新token成功').success(res)
    }
)

module.exports = router

const express = require('express')
const multer = require('multer')
const  { UPLOAD_PATH } = require('../utils/constant')
const Result = require('../models/Result')
const Book = require('../models/Book')
const boom =  require('boom')
const bookService = require('../service/book')

const router = express.Router()


router.post(
    '/upload',
    multer({ dest: `${ UPLOAD_PATH }/book`}).single('file'),
    function (req, res, next) {
        if(!req.file || req.file.lenght===0) {
            new Result('上传电子书失败').fail(res)
        }else{
            const book = new Book(req.file)
            book.parse()
                .then(book => {
                    new Result(book,'上传电子书成功').success(res)
                })
                .catch(err => {
                    next(boom.badImplementation(err))
                })
        }
})

router.post(
    '/create',
    function (req, res, next) {
        if (req.user && req.user.username) {
            req.body.username = req.user.username
        }
        const book = new Book(null, req.body)
        bookService.insertBook(book)
            .then(() => {
                new Result('添加电子书成功').success(res)
            })
            .catch(e => {
                next(boom.badImplementation(e))
            })
    }
)

router.post(
    '/update',
    function (req, res, next) {
        if (req.user && req.user.username) {
            req.body.username = req.user.username
        }
        const book = new Book(null, req.body)
        bookService.updateBook(book)
            .then(() => {
                new Result('更新电子书成功').success(res)
            })
            .catch(e => {
                next(boom.badImplementation(e))
            })
    }
)

router.get(
    '/get',
    function (req, res, next) {
        const { fileName } = req.query
        if (!fileName) {
            next(boom.badRequest(new Error('参数fileName不能为空')))
        } else{
            bookService.getBook(fileName)
                .then(book => {
                    new Result(book,'获取电子书信息成功').success(res)
                })
                .catch(e => {
                    next(boom.badImplementation(err))
                })
        }
    }
)

router.get(
    '/category',
    function (req, res, next) {
        bookService.getCategory()
            .then(category => {
                new Result(category,'获取分类成功').success(res)
            })
            .catch(e => {
                next(boom.badImplementation(e))
            })
    }
)

router.get(
    '/list',
    function (req, res, next) {
        bookService.getBookList(req.query)
            .then(({ list, count, page, pageSize }) => {
                new Result({list, count, page, pageSize},'获取图书列表成功').success(res)
            })
            .catch(e => {
                next(boom.badImplementation(e))
            })
    }
)

router.get(
    '/delete',
    function (req, res, next) {
        const { fileName } = req.query
        bookService.deleteBook(fileName)
            .then(() => {
                new Result('删除电子书成功').success(res)
            })
            .catch(e => {
                next(boom.badImplementation(e))
            })
    }
)

module.exports = router

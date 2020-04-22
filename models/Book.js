const { MIME_TYPE_EPUB, UPLOAD_PATH, UPLOAD_URL } = require('../utils/constant')
const fs = require('fs')
const Epub = require('../utils/epub')
const xml2js = require('xml2js').parseString
const path = require('path')
const _ =require('lodash')

class Book {
    constructor(file, data) {
        if (file) {
           this.createBookFromFile(file)
        } else {
            this.createBookFromData(data)
        }
    }
    createBookFromFile(file) {
        const { destination, filename, originalname, mimetype = MIME_TYPE_EPUB, path } = file
        // 电子书文件后缀名
        const suffix = mimetype === MIME_TYPE_EPUB ? '.epub' : ''
        // 电子书原有路径
        const oldBookPath = path
        // 电子书新路径
        const bookPath = `${destination}/${filename}${suffix}`
        // 电子书下载URL
        const url = `${UPLOAD_URL}/book/${filename}${suffix}`
        // 电子书解压后文件夹路径
        const unzipPath = `${UPLOAD_PATH}/unzip/${filename}`
        // 电子书解压后文件夹URL
        const unzipUrl = `${UPLOAD_URL}/unzip/${filename}`

        if(!fs.existsSync(unzipPath)) {
            fs.mkdirSync(unzipPath, {recursive: true})
        }
        if(fs.existsSync(oldBookPath) && !fs.existsSync(bookPath)){
            fs.renameSync(oldBookPath,bookPath)
        }
        this.fileName = filename // 文件名
        this.originalName = originalname // 电子书原名
        this.path = `/book/${filename}${suffix}` // epub文件相对路径
        this.filePath = this.path
        this.url = url // 电子书下载链接
        this.unzipPath = `/unzip/${filename}` // epub解压后相对路径
        this.unzipUrl = unzipUrl // 解压后文件链接
        this.title = '' // 书名
        this.author = '' // 作者
        this.publisher = '' // 出版社
        this.contents = [] // 目录
        this.coverPath = '' // 封面图片路径
        this.cover = '' // 封面图片URL
        this.category = -1 // 分类ID
        this.categoryText = '' // 分类名称
        this.language = '' // 语言
    }
    createBookFromData(data) {
        function getBookAttr(attrList,data) {
            attrList.forEach(attr=>{
                this[attr]=data[attr]
            })
        }
        getBookAttr.call(this,['fileName','cover','title','author','publisher','language','rootFile','originalName','unzipPath','coverPath'],data)

        this.bookId = data.fileName
        this.path = data.path || data.filePath
        this.filePath = data.path || data.filePath
        this.createUser = data.username
        this.createDt = new Date().getTime()
        this.updateDt = new Date().getTime()
        this.updateType = data.updateType === 0 ? data.updateType : 1
        this.category = data.category || 99
        this.categoryText = data.categoryText || '自定义'
        this.contents = data.contents || []
    }

    // 解析电子书
    parse() {
        return new Promise((resolve, reject) => {
            const bookPath = `${UPLOAD_PATH}${this.filePath}`
            if (!fs.existsSync(bookPath)) {
                reject(new Error('电子书不存在'))
            }
            const epub = new Epub(bookPath)
            epub.on('error', err => {
                reject(err)
            })
            epub.on('end', err => {
                if (err) {
                    reject(err)
                } else {
                    const { title, creator, creatorFileAs, language, publisher, cover} = epub.metadata
                    if (!title) {
                        reject(new Error('图书标题为空'))
                    } else {
                        this.title = title
                        this.language = language || 'en'
                        this.author = creator || creatorFileAs || 'unknown'
                        this.publisher = publisher || 'unknown'
                        this.rootFile = epub.rootFile

                        // 解析封面图
                        const handleGetImage = (err, file, mimeType) => {
                            if (err) {
                                reject(err)
                            } else {
                                const suffix = mimeType.split('/')[1]
                                const coverPath = `${UPLOAD_PATH}/img/${this.fileName}.${suffix}`
                                const coverUrl = `${UPLOAD_URL}/img/${this.fileName}.${suffix}`
                                fs.writeFileSync(coverPath, file, 'binary')
                                this.coverPath = `/img/${this.fileName}.${suffix}`
                                this.cover = coverUrl
                                resolve(this)
                            }
                        }
                        try {
                            this.unzip()
                            this.parseContents(epub).then( ({contents,contentTree}) => {
                                this.contents = contents
                                this.contentTree = contentTree
                                epub.getImage(cover,handleGetImage)
                            })
                        } catch(e) {
                            reject(e)
                        }
                    }
                }
            })
            epub.parse()
        } )
    }

    // 解压电子书
    unzip() {
        const AdmZip = require('adm-zip')
        const zip = new AdmZip(Book.getPath(this.path)) // 传入绝对路径
        zip.extractAllTo(Book.getPath(this.unzipPath), true) // 解压至新路径,若已存在，则覆盖
    }

    // 解析目录
    parseContents(epub) {
        const ncxFilePath = Book.getPath(`${this.unzipPath}/${getNcxFilePath()}`)
        const xml = fs.readFileSync(ncxFilePath, 'utf-8')
        const dir = path.dirname(ncxFilePath).replace(UPLOAD_PATH,'')

        // 获取目录文件路径
        function getNcxFilePath() {
            const spine = epub && epub.spine
            const manifest = epub && epub.manifest
            const ncx = spine.toc && spine.toc.href
            const id = spine.toc && spine.toc.id
            if (ncx) {
                return ncx
            } else {
                return manifest[id].href
            }
        }

        // 添加 父id
        function findParent(array, level = 0, pid = '') {
            return array.map(item=>{
                item.level = level
                item.pid = pid
                if (item.navPoint && item.navPoint.length > 0 ){
                    item.navPoint = findParent(item.navPoint, level + 1, item['$'].id )
                } else if (item.navPoint) {
                    item.navPoint.level = level + 1
                    item.pid = item['$'].id
                }
                return item
            })
        }

        // 嵌套数组 转为 一维数组
        function flatten(array) {
            return [].concat(...array.map(item=>{
                if (item.navPoint && item.navPoint.length > 0) {
                    return [].concat(item,...flatten(item.navPoint))
                } else if (item.navPoint) {
                    return [].concat(item, item.navPoint)
                }
                return item
            }))
        }

        // 定义目录信息
        function getContents(navMap) {
            const contents = []
            navMap.forEach( (content, index)=> {
                const src = content.content['$'].src
                content.id = `${src}`
                content.href = `${dir}/${src}`.replace(`${this.unzipPath}`,'')
                content.text = `${UPLOAD_URL}${dir}/${src}`
                content.label = content.navLabel.text || ''
                content.navId = content['$'].id
                content.fileName = this.fileName
                content.order = index + 1
                contents.push(content)
            })
            return contents
        }



        if (!fs.existsSync(ncxFilePath)) {
            return new Error('电子书目录不存在')
        }
        return new Promise((resolve, reject)=> {
          //  const fileName = this.fileName
            xml2js(
                xml,
                {explicitArray:false,ignoreAttrs:false},
                (err, json)=>{
                    if (err) {
                        reject(err)
                    }
                    const navMap = json.ncx.navMap
                    if ( !navMap.navPoint && navMap.navPoint <= 0 ) {
                        reject(new Error('电子书目录解析失败，目录数为0'))
                    }
                    navMap.navPoint = findParent(navMap.navPoint)
                    const newNavMap = flatten(navMap.navPoint)
                    const contents = getContents.call(this,newNavMap)
                    const contentTree = Book.getContentTree(contents)
                    resolve({ contents, contentTree })
                }
            )
        })
    }

    // 保留数据表所需字段
    toDb() {
        let obj = {...this}
        delete obj.path
        delete obj.contents
        return obj
    }

    // 获取目录
    getContents() {
        return this.contents
    }

    reset() {
        if (Book.pathExists(this.filePath)) {
            fs.unlinkSync(Book.getPath(this.filePath))
        }
        if (Book.pathExists(this.coverPath)) {
            fs.unlinkSync(Book.getPath(this.coverPath))
        }
        if (Book.pathExists(this.unzipPath)) {
            fs.rmdirSync(Book.getPath(this.unzipPath),{recursive:true}) // 迭代删除
        }
    }

    // 目录 转为 树状结构
    static getContentTree(contents) {
        const contentTree = []
        contents.forEach(c => {
            c.children = []
            if (c.pid === ''){
                contentTree.push(c)
            } else {
                const parent = contents.find(_ => _.navId === c.pid)
                parent.children.push(c)
            }
        })
        return contentTree
    }

    static getPath(path) {
        if(!path.startsWith('/')) {
            path = `/${path}`
        }
        return `${UPLOAD_PATH}${path}`
    }

    static pathExists(path) {
        if(!path.startsWith(UPLOAD_PATH)){
            path = Book.getPath(path)
        }
        return fs.existsSync(path)
    }
}

module.exports = Book

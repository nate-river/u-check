var express = require('express');
var multiparty = require('multiparty');
var router = express.Router();
var query = require("../mysql.js");
var crypto = require('crypto');
var pool = require("./mysql");
var async = require("async");
var moment = require('moment');//处理时间
var upload = require("./fileuploads");  //文件上传
var xlsx = require("node-xlsx");
var fs = require("fs");
var path = require("path");
/* GET users listing. */
//试题管理
var uploadImg = [];//保存图片filename
//获取添加试题页面数据
router.use('/addQuestData', function(req, res, next) {
    pool.getConnection(function (err, conn) {
    conn.query(`select * from type`, function (error, rows, field) {
        conn.release();
        pool.getConnection(function (err, conn) {
            conn.query("select * from stage where s_id=234", function (error, vals, fields) {
                if (!error) {
                    conn.release();
                    pool.getConnection(function (err, conn) {
                        conn.query("select * from stage", function (error, rows1, field) {
                            if (!error) {
                                conn.release();
                                res.json({data: rows, data1: vals, data2: rows1});
                            }
                        })
                    })
                }
            })
        })
    })
})
})
;
//发送添加试题页面
router.use('/addQuestion', function (req, res, next) {
    uploadImg = [];
    res.render('admin/add');
});
//添加试题
router.use('/addQue', function (req, res, next) {
    var flag = true;
    var qustionId = null;
    let data = req.body;
    let stageId = null;
    let idArr = [];
    data.selectStage.forEach(function(v, i) {
        let id = v.split("-")[1];
    idArr.push(id);
})
    stageId = idArr.join(";");
    //添加试题
    pool.getConnection(function (err1, conn1) {
        conn1.query("INSERT INTO question (about,type_id,stage_id,del) VALUES (?,?,?,0)", [data.desc, data.selectType, stageId], function (error1, rows1, field1) {
            conn1.release();
            if (!error1) {
                qustionId = rows1.insertId;
                async.series([
                    function (callback) {
                        //单选、多选
                        var j = 0;
                        var arr = [];
                        if (data.selectType == "1") {
                            for (var i = 1; i <= 4; i++) {
                                var o = "option" + i;
                                var newarr = [];
                                newarr.push(qustionId);
                                newarr.push(0);
                                newarr.push(data[o]);
                                newarr.push(i);
                                arr.push(newarr);
                            }
                        } else if (data.selectType == "2") {
                            for (var i = 5; i <= 11; i++) {
                                var o = "option" + i;
                                var newarr = [];
                                newarr.push(qustionId);
                                newarr.push(0);
                                newarr.push(data[o]);
                                newarr.push(i - 4);
                                arr.push(newarr);
                            }
                        } else {
                            j = 0;
                        }

                        if (arr.length > 0) {
                            var sql = "INSERT INTO options (q_id,del,con,mark) VALUES ?";
                            pool.query(sql, [arr], function (error, rows, field) {
                                if (error) {
                                    res.json({
                                        code: "500",
                                        info: "添加选项失败"
                                    })
                                }
                            })
                        }
                        //添加解析
                        if (data.analysis) {
                            pool.getConnection(function (err, conn) {
                                conn.query("INSERT INTO analysis (q_id,del,con) VALUES (?,0,?)", [qustionId, data.analysis], function (error, vals, fields) {
                                    conn.release();
                                    if (error) {
                                        res.json({
                                            code: "500",
                                            info: "添加解析失败"
                                        })
                                    }
                                });
                            });
                        }
                        //添加答案
                        pool.getConnection(function (err, conn) {
                            var answer;
                            if (data.answerRadio) {
                                answer = data.answerRadio;
                            } else if (data.answerCheckbox) {
                                answer = data.answerCheckbox
                            } else if (data.answer) {
                                answer = data.answer;
                            }
                            if (typeof(answer) == "object") {
                                answer.sort(function (x, y) {
                                    return x - y;
                                })
                                answer = answer.join(";");
                            }
                            conn.query("INSERT INTO solution (q_id,del,correct) VALUES (?,?,?)", [qustionId, 0, answer], function (error, vals, fields) {
                                conn.release();
                                if (error) {
                                    res.json({
                                        code: "500",
                                        info: "添加答案失败"
                                    })
                                }
                            });
                        })
                        //添加图片
                        pool.getConnection(function (err, conn3) {
                            if (!uploadImg.length == 0) {
                                uploadImg.forEach(function (v, i) {
                                    var imgSrc = "/img/adminImg/" + v;
                                    conn3.query("insert into picture (q_id,del,imgurl) VALUES (?,0,?)", [qustionId, imgSrc], function (error, rows, fields) {
                                        if (error) {
                                            res.json({
                                                code: "500",
                                                info: "添加图片失败"
                                            })
                                        }
                                    })
                                })
                            }
                        });
                        callback(null);
                    }
                ], function () {
                    res.json({
                        code: "200",
                        info: "添加试题成功"
                    })
                })
            } else {
                res.json({
                    code: "500",
                    info: "添加试题失败"
                })
            }
        })
    })
});
//添加试题图片
router.use("/addPicture", upload.single("file"), function (req, res) {
    var arr = req.file.originalname.split(".");
    var suffix = arr[arr.length - 1];
    var timestamp = JSON.stringify(new Date());
    var hash = crypto.createHash('md5');
    hash.update(timestamp);
    var name = hash.digest('hex');
    let imgName = name + "." + suffix;

    async.series([
        function (callback) {
            fs.createReadStream(req.file.path).pipe(fs.createWriteStream(path.resolve("./public/img/adminImg", imgName)));
            callback(null)
        },
        function (callback) {
            fs.unlink(path.resolve(req.file.path));
            callback(null)
        }
    ], function () {
        res.json({
            code: "200",
            info: "OK"
        })
        uploadImg.push(imgName);
    })
});
//移除试题图片
router.use("/removePicture", function (req, res) {
    var index = req.body.index;
    let imgName = uploadImg[index];
    fs.unlink(path.resolve("./public/img/adminImg", imgName));
    uploadImg.splice(index, 1);
});


//习题选项、解析、答案管理
router.use("/editOption", function (req, res) {
    pool.getConnection(function (err, conn) {
        pool.query("select * from question where del=0 order by id desc", function (error, vals, fields) {
            conn.release();
            if (!error) {
                res.render("admin/editOption", {rows1: vals})
            }
        });
    });
});
router.use("/editQuestion/:id", function (req, res, next) {
    var tid = req.params.id;
    pool.getConnection(function (err, conn) {
        conn.query("select * from options where q_id=?", [tid], function (error, rows, fields) {
            conn.release();
            if (!error) {
                pool.getConnection(function (err, conn) {
                    conn.query("select * from analysis where q_id=?", [tid], function (error, rows1, fields) {
                        if (!error) {
                            conn.release();
                            pool.getConnection(function (err, conn) {
                                conn.query("select * from solution where q_id=?", [tid], function (error, rows2, fields) {
                                    if (!error) {
                                        conn.release();
                                        pool.getConnection(function (err, conn) {
                                            conn.query("select * from question where id=?", [tid], function (error, rows3, fields) {
                                                if (!error) {
                                                    conn.release();
                                                    res.render("admin/editQuest", {
                                                        data1: rows,
                                                        data2: rows1,
                                                        data3: rows2,
                                                        data4: rows3
                                                    });
                                                }
                                            })
                                        })
                                    }
                                })
                            })
                        }
                    })
                })
            }
        })
    })
});
//类型管理
router.use('/editType', function (req, res, next) {
    pool.query(`select * from type`, function (error, rows, field) {
        res.render('admin/column', {data: rows});
    })
});


router.use('/addType', function (req, res, next) {
    var name = req.body.name;
    var del = req.body.del;
    pool.query(`insert into  type (name,del) values ('${name}','${del}') `, function (error, rows, field) {
        if (error) {
            res.send("数据储存出现错误！！");
        } else {
            res.redirect('/admin/editType');
        }
    })
});


router.use('/deleteType', function (req, res) {
    pool.query('delete from type where id in (' + req.body.id + ')', function (err, rows) {
        res.json({state: 'ok'});
    })
});


router.use('/updateType', function (req, res) {
    pool.query('update type set name=? where id=?', [req.body.name, req.body.id], function (err, rows) {
        if (!err) {
            res.json({state: 'ok'});
        }
    })
});
router.use("/updateQuest", function (req, res, next) {
    pool.query('update question set about=? where id=?', [req.body.val, req.body.id], function (err, rows) {
        if (!err) {
            res.json({state: 'ok'});
        }
    })
});
router.use("/updateOptions", function (req, res, next) {
    pool.query('update options set con=? where id=?', [req.body.val, req.body.id], function (err, rows) {
        if (!err) {
            res.json({state: 'ok'});
        }
    })
});
router.use("/updateAnalysis", function (req, res, next) {
    pool.query('update analysis set con=? where id=?', [req.body.val, req.body.id], function (err, rows) {
        if (!err) {
            res.json({state: 'ok'});
        }
    })
});
router.use("/updateSolution", function (req, res, next) {
    pool.query('update solution set correct=? where id=?', [req.body.val, req.body.id], function (err, rows) {
        if (!err) {
            res.json({state: 'ok'});
        }
    })
});
router.use("/editDelete", function (req, res, next) {
    pool.query('delete from question where id in (' + req.body.id + ')', function (err, rows) {
        pool.query('delete from options where q_id in (' + req.body.id + ')', function (err, rows) {
            pool.query('delete from solution where q_id in (' + req.body.id + ')', function (err, rows) {
                pool.query('delete from analysis where q_id in (' + req.body.id + ')', function (err, rows) {
                    pool.query('delete from picture where q_id in (' + req.body.id + ')', function (err, rows) {
                        res.json({state: 'ok'});
                    })
                })
            })
        })
    })
})


//阶段管理

router.use('/editStage', function (req, res, next) {
    res.render('admin/list')
});
router.use('/showStage', function (req, res, next) {
    pool.query('SELECT * from stage order by id DESC', function (err, rows) {
        res.json(rows);   //将数组发回去
    });

});
router.use('/addStage', function (req, res, next) {

    var name = req.body.name;
    var sid = req.body.id;

    pool.query(`insert into stage (name,s_id) values ('${name}','${sid}') `, function (error, rows, field) {
        if (error) {
            res.send("数据储存出现错误！！");
        } else {
            res.json(rows.insertId);
        }
    })
});
router.use('/deleteStage', function (req, res) {

    pool.query('delete from stage where id in (' + req.body.ids + ')', function (err, rows) {
        res.json({state: 'ok'});
    })
});
router.use('/updateStage', function (req, res) {
    pool.query('update stage set name=? where id=?', [req.body.name, req.body.id], function (err, rows) {
        if (!err) {
            res.json({state: 'ok'});
        }
    })
});
router.use('/addZiStage', function (req, res, next) {
    var name = '';
    var sid = req.body.sid;
    var del = req.body.del;
    pool.query(`insert into stage (name,s_id,del) values ('${name}','${sid}','${del}') `, function (error, rows, field) {
        if (error) {
            res.send("数据储存出现错误！！");
        } else {
            res.json(rows.insertId);
        }
    })
});


//登录模块
router.get('/', function (req, res, next) {
    res.render("admin/index");
});
router.get("/uek", function (req, res, next) {
    res.render("admin/uek");
});
router.use("/addclass", function (req, res, next) {
    var num = null;
    if (!num) {
        query(`select * from class where del=0 order by id Desc`, function (error, rows, field) {
            if (error) {
                console.log(error);
            } else {
                rows.forEach(function (obj, i) {
                    obj.xid = i + 1;
                    var uptime = obj.uptime;
                    var addtime = obj.uptime;
                    if (uptime) {
                        if (addtime) {
                            obj.uptime = moment(uptime).format('YYYY MM DD');
                            obj.addtime = moment(addtime).format('YYYY MM DD');
                        }
                    }
                });
                res.render("admin/addclass", {data: rows});
            }

        });
    } else {/* undefine 0(第一张)  1（第二张） */
        num = num * 5;
        query(`select * from class where del=0 order by id Desc limit ${num},5`, function (error, rows, field) {
            if (error) {
                console.log(error);
            } else {
                rows.forEach(function (obj, i) {
                    obj.xid = i + 1;
                    var genre = obj.genre;
                    if (genre == 0) {
                        obj.genre = "前端";
                    } else if (genre == 1) {
                        obj.genre = "UI";
                    } else if (genre == 2) {
                        obj.genre = "PHP";
                    }
                    var uptime = obj.uptime.toString();
                    var addtime = obj.uptime.toString();
                    if (uptime) {
                        if (addtime) {
                            obj.uptime = moment(uptime).format('YYYY MM DD');
                            obj.addtime = moment(addtime).format('YYYY MM DD');
                        }
                    }
                });
                res.send(rows);
            }
        });
    }

});
router.use("/addclassdata", function (req, res, next) {
    var cname = req.body.cname;
    var genre = req.body.genre;
    var addtime = moment();
    query(`insert into class (cname,genre,addtime,del) values ('${cname}','${genre}','${addtime}',0)`, function (error, row, field) {
        if (error) {
            console.log(error);
        } else {
            res.redirect('/admin/addclass');
            /*跳转*/
        }
    })

});
router.use("/classdel", function (req, res, next) {
    var id = req.body.id;
    query(`select * from student where c_id='${id}'`, function (error, rows1, field) {
        if (error) {
            console.log(error);
        } else {
            if (rows1.length == 0) {
                query(`update class set del=1 where id='${id}'`, function (error, rows, field) {
                    if (error) {
                        console.log(error)
                    } else {
                        res.redirect('/admin/addclass');
                    }
                })
            } else {
                res.redirect('/admin/addclass');
            }
        }
    });

});
router.use("/delclassall", function (req, res, next) {
    var arr = req.body['id[]'];
    var id = "";
    for (var i = 0; i < arr.length; i++) {
        id = id + arr[i] + ",";
    }
    id = id.slice(0, -1);
    query(`update class set del=1 where id in (${id})`, function (error, rows, field) {
        if (error) {

        } else {
            res.redirect('/admin/addclass');
        }
    });
});
router.use("/updataclassdata", function (req, res, next) {
    var id = req.body.cid;
    var cname = req.body.cname;
    var genre = req.body.genre;
    var uptime = new Date().toLocaleString();
    query(`update class set cname='${cname}',genre='${genre}',uptime='${uptime}' where id='${id}'`, function (error, rows, field) {
        if (error) {
            console.log(error);
        } else {
            res.redirect("/admin/addclass");
        }
    })
});


router.use("/addteacher", function (req, res, next) {
    var num = req.body.num;
    if (num) {
        num = num * 5;
        query(`select * from teacher where del=0 order by jobnum Asc limit ${num},5`, function (error, rows, field) {
            if (error) {
                console.log(error);
            } else {
                rows.forEach(function (obj, i) {
                    obj.xid = i + 1;
                    var uptime = obj.uptime;
                    var addtime = obj.uptime;
                    if (uptime) {
                        if (addtime) {
                            obj.uptime = moment(uptime).format('YYYY MM DD');
                            obj.addtime = moment(addtime).format('YYYY MM DD');
                        }
                    }
                });
                res.send(rows);
            }
        });

    } else {
        query(`select * from teacher where del=0 order by jobnum ASC limit 0,5`, function (error, rows1, field) {
            if (error) {
                console.log(error);
            } else {
                query(`select * from class where del=0`, function (error, rows, field) {
                    rows1.forEach(function (obj, i) {
                        obj.xid = i + 1;
                        var uptime = obj.uptime;
                        var addtime = obj.uptime;
                        if (uptime) {
                            if (addtime) {
                                obj.uptime = moment(uptime).format('YYYY MM DD');
                                obj.addtime = moment(addtime).format('YYYY MM DD');
                            }
                        }

                    });
                    res.render("admin/addteacher", {data: rows1, clas: rows});
                });
            }
        });
    }


});
router.use("/addteacherkey", function (req, res, next) {
    var tname = req.body.keywords;
    query(`select * from teacher where del=0 and tname='${tname}'`, function (error, rows, field) {
        if (error) {
            console.log(error);
        } else {
            rows.forEach(function (obj, i) {
                var uptime = obj.uptime;
                var addtime = obj.uptime;
                if (uptime) {
                    if (addtime) {
                        obj.uptime = moment(uptime).format('YYYY MM DD');
                        obj.addtime = moment(addtime).format('YYYY MM DD');
                    }
                }
            });
            res.send(rows);
        }
    });
});
router.use("/addteacherdata", function (req, res, next) {
    var jobnum = req.body.jobnum;
    var tname = req.body.tname;
    var cid = req.body.cid;
    var cid2 = req.body.cid2;
    cid = cid + "," + cid2;
    var pass1 = req.body.pass1;
    var md5 = crypto.createHash('md5');
    md5.update(pass1);
    pass1 = md5.digest("hex");
    var addtime = new Date().toLocaleString();
    query(`insert into teacher (jobnum,tname,pass,c_id,del,addtime) values ('${jobnum}','${tname}','${pass1}','${cid}',0,'${addtime}')`, function (error, rows, filed) {
        if (error) {
            console.log(error);
        } else {
            res.redirect("/admin/addteacher")
        }
    })
});
router.use("/teacherdel", function (req, res, next) {
    var id = req.body.id;
    query(`update teacher set del=1 where id='${id}'`, function (error, rows, field) {
        if (error) {
            console.log(error)
        } else {
            res.redirect('/admin/addteacher');
        }
    })
});
router.use("/updatateacherdata", function (req, res, next) {
    var id = req.body.tid;
    var jobnum = req.body.jobnum;
    var tname = req.body.tname;
    var cid = req.body.cid;
    var cid2 = req.body.cid2;
    if (cid2) {
        cid = cid + "," + cid2;
    }
    var pass1 = req.body.pass1;
    var md5 = crypto.createHash('md5');
    md5.update(pass1);
    pass1 = md5.digest("hex");
    var uptime = new Date().toLocaleString();
    query(`update teacher set jobnum='${jobnum}',c_id='${cid}',tname='${tname}',pass='${pass1}',uptime='${uptime}' where id='${id}'`, function (error, rows, field) {
        if (error) {
            console.log(error);
        } else {
            res.redirect("/admin/addteacher");
        }
    })
});
router.use("/delteacherall", function (req, res, next) {
    var arr = req.body['id[]'];
    var id = "";
    for (var i = 0; i < arr.length; i++) {
        id = id + arr[i] + ",";
    }
    id = id.slice(0, -1);
    query(`update teacher set del=1 where id in (${id})`, function (error, rows, field) {
        if (error) {

        } else {
            res.redirect('/admin/addteacher');
        }
    });
});

router.use("/addstudent", function (req, res, next) {
    if (!req.body.num) {
        if (req.body.values) {
            var num = req.body.num || 0;
            var values = req.body.values;
            num = num * 10;
            query(`select * from studentsclass where del=0 and cname='${values}' order by stdnum ASC limit ${num},10`, function (error, rows, field) {
                if (error) {
                    console.log(error);
                } else {
                    query(`select * from class where del=0`, function (error, rows2, field) {
                        if (error) {

                        } else {
                            rows.forEach(function (obj, i) {
                                obj.xid = i + 1;
                                var uptime = obj.uptime;
                                var addtime = obj.uptime;
                                obj.uptime = moment(uptime).format('YYYY MM DD');
                                obj.addtime = moment(addtime).format('YYYY MM DD');
                            });
                            res.send({stud: rows, clas: rows2});
                        }
                    })

                }

            });
        } else {
            query(`select * from studentsclass where del=0 order by stdnum DESC limit 0,10`, function (error, rows, field) {
                if (error) {
                    console.log("error");
                } else {
                    query(`select * from class where del=0`, function (error, rows2, field) {
                        if (error) {

                        } else {
                            rows.forEach(function (obj, i) {
                                obj.xid = i + 1;
                                var uptime = obj.uptime;
                                var addtime = obj.uptime;
                                obj.uptime = moment(uptime).format('YYYY MM DD');
                                obj.addtime = moment(addtime).format('YYYY MM DD');
                            });
                            res.render("admin/addstudent", {stud: rows, clas: rows2});
                        }
                    })

                }

            });
        }

    } else if (req.body.values) {
        var num = req.body.num;
        var values = req.body.values;
        num = num * 10;
        query(`select * from studentsclass where del=0 order by id DESC limit ${num},10 where c_id='${values}'`, function (error, rows, field) {
            if (error) {
                console.log("error");
            } else {
                query(`select * from class where del=0`, function (error, rows2, field) {
                    if (error) {

                    } else {
                        rows.forEach(function (obj, i) {
                            obj.xid = i + 1;
                            var uptime = obj.uptime.toString();
                            var addtime = obj.uptime.toString();
                            obj.uptime = moment(uptime).format('YYYY MM DD');
                            obj.addtime = moment(addtime).format('YYYY MM DD');
                        });
                        res.send({stud: rows, clas: rows2});
                    }
                })

            }

        });
    } else {
        var num = req.body.num;
        num = num * 10;
        query(`select * from studentsclass where del=0 order by id DESC limit ${num},10`, function (error, rows, field) {
            if (error) {
                console.log("error");
            } else {
                query(`select * from class where del=0`, function (error, rows2, field) {
                    if (error) {

                    } else {
                        rows.forEach(function (obj, i) {
                            obj.xid = i + 1;
                            var uptime = obj.uptime;
                            var addtime = obj.uptime;
                            obj.uptime = moment(uptime).format('YYYY MM DD');
                            obj.addtime = moment(addtime).format('YYYY MM DD');
                        });
                        res.send({stud: rows, clas: rows2});
                    }
                })

            }

        });
    }
});
//查看某个班级全部信息
router.use("/addstudentdata", function (req, res, next) {
    var c_id = req.body.c_id;
    var stdnum;
    var index;  //班级第几个
    var sname = req.body.sname;
    var phone = req.body.phone;
    var pass1 = req.body.pass1;
    var genre = req.body.genre;
    var md5 = crypto.createHash('md5');
    md5.update(pass1);
    pass1 = md5.digest("hex");
    var addtime = new Date().toLocaleString();

    query(`select * from student where c_id='${c_id}' and del=0 order by stdnum DESC`, function (error, rows, field) {
        if (error) {
        } else {
            var date = new Date();
            /*年*/
            var y = date.getFullYear().toString();
            var m = date.getMonth() + 1;
            /*月份*/
            if (m < 10) {
                m = "0" + m;
            }
            m = m.toString();
            /*专业  genre*/
            genre = genre.toString();
            /*班级 c_id*/
            if (c_id < 10 && c_id >= 0) {
                c_id = "000" + c_id;
            } else if (c_id >= 10 && c_id < 100) {
                c_id = "00" + c_id;
            } else if (c_id >= 100 && c_id < 1000) {
                c_id = "0" + c_id;
            }
            c_id = c_id.toString();

            if (rows.length > 0) {
                /*
                 * 年 +  月份 +  专业 +   班级   +   学生
                 *  4  +  2   +  1    +  4    +    3   =  14
                 * */
                index=rows[0].stdnum.substr(-1,3);
                index++;
                if (index < 10 && index >= 0) {
                    index="00"+index;
                } else if (index >= 10 && index < 100) {
                    index = "0" + index;
                }
                index = index.toString();
                //学号组合
                stdnum = y + m + genre + c_id + index;
            } else {
                index = "001";
                stdnum = y + m + genre + c_id + index;
            }
            var sql=`insert into student (c_id,sname,phone,del,stdnum,pass,addtime,genre) values ('${c_id}','${sname}','${phone}',0,'${stdnum}','${pass1}','${addtime}','${genre}')`;
            query(sql, function (error, rows, field) {
                if (error) {
                    console.log(error);
                } else {
                    res.redirect("addstudent");
                }
            })
        }
    });
});
router.use("/studentdel", function (req, res, next) {
    var id = req.body.id;
    query(`delete from student where id='${id}'`, function (error, rows, field) {
        if (error) {

        } else {
            res.redirect("/admin/addstudent");
        }
    })
});
router.use("/updatastudentdata", function (req, res, next) {
    var id = req.body.sid;
    var sname = req.body.sname;
    var phone = req.body.phone;
    var c_id = req.body.c_id;
    var pass1 = req.body.pass1;
    var md5 = crypto.createHash('md5');
    md5.update(pass1);
    pass1 = md5.digest("hex");
    var uptime = new Date().toLocaleString();
    query(`update student set sname='${sname}',phone='${phone}',c_id=${c_id},pass='${pass1}',uptime='${uptime}' where id='${id}'`, function (error, rows, field) {
        if (error) {
            console.log(error);
        } else {
            res.redirect("/admin/addstudent");
        }
    })
});
router.use("/delstudentall", function (req, res, next) {
    var arr = req.body['id[]'];
    var id = "";
    for (var i = 0; i < arr.length; i++) {
        id = id + arr[i] + ",";
    }
    id = id.slice(0, -1);
    query(`update student set del=1 where id in (${id})`, function (error, rows, field) {
        if (error) {

        } else {
            res.redirect('/admin/addstudent');
        }
    });
});

router.use("/selectT", function (req, res, next) {
    var id = req.body.id;
    query(`select * from teacher where id='${id}'`, function (error, rows, field) {
        if (error) {

        } else {
            res.send(rows);
        }
    })
});
router.use("/selectC", function (req, res, next) {
    var id = req.body.id;
    query(`select * from class where id='${id}'`, function (error, rows, field) {
        if (error) {

        } else {
            res.send(rows);
        }
    })
});
router.use("/selectS", function (req, res, next) {
    var id = req.body.id;
    query(`select * from student where id='${id}'`, function (error, rows, field) {
        if (error) {

        } else {
            res.send(rows);
        }
    })
});
router.use("/selectA", function (req, res, next) {
    var id = req.body.id;
    query(`select * from Administrator where id='${id}'`, function (error, rows, field) {
        if (error) {

        } else {
            res.send(rows);
        }
    })
});

router.use("/selectclass", function (req, res, next) {
    if (!req.body.num) {
        query(`select * from studentsclass where del=0 order by id DESC limit 0,10`, function (error, rows, field) {
            if (error) {
                console.log("error");
            } else {
                query(`select * from class where del=0`, function (error, rows2, field) {
                    if (error) {

                    } else {
                        rows.forEach(function (obj, i) {
                            obj.xid = i + 1;
                            var uptime = obj.uptime.toString();
                            var addtime = obj.uptime.toString();
                            obj.uptime = moment(uptime).format('YYYY MM DD');
                            obj.addtime = moment(addtime).format('YYYY MM DD');
                        });
                        res.render("admin/addstudent", {stud: rows, clas: rows2});
                    }
                })

            }

        });
    } else {
        var num = req.body.num;
        num = num * 10;
        var values = req.body.values;
        if (values) {
            query(`select * from studentsclass where del=0 order by id DESC limit ${num},10 where c_id='${values}'`, function (error, rows, field) {
                if (error) {
                    console.log("error");
                } else {
                    query(`select * from class where del=0`, function (error, rows2, field) {
                        if (error) {

                        } else {
                            rows.forEach(function (obj, i) {
                                obj.xid = i + 1;
                                var uptime = obj.uptime.toString();
                                var addtime = obj.uptime.toString();
                                obj.uptime = moment(uptime).format('YYYY MM DD');
                                obj.addtime = moment(addtime).format('YYYY MM DD');
                            });
                            res.send({stud: rows, clas: rows2});
                        }
                    })

                }

            });
        } else {
            query(`select * from studentsclass where del=0 order by id DESC limit ${num},10`, function (error, rows, field) {
                if (error) {
                    console.log("error");
                } else {
                    query(`select * from class where del=0`, function (error, rows2, field) {
                        if (error) {

                        } else {
                            rows.forEach(function (obj, i) {
                                obj.xid = i + 1;
                                var uptime = obj.uptime.toString();
                                var addtime = obj.uptime.toString();
                                obj.uptime = moment(uptime).format('YYYY MM DD');
                                obj.addtime = moment(addtime).format('YYYY MM DD');
                            });
                            res.send({stud: rows, clas: rows2});
                        }
                    })

                }

            });
        }

    }
});

router.use("/addAdministrator", function (req, res, next) {
    query(`select * from Administrator where del=0 order by id DESC `, function (error, rows, field) {
        if (error) {
            console.log(error);
        } else {
            rows.forEach(function (obj, i) {
                obj.xid = i + 1;
                var uptime = obj.uptime.toString();
                var addtime = obj.uptime.toString();
                obj.uptime = moment(uptime).format('YYYY MM DD');
                obj.addtime = moment(addtime).format('YYYY MM DD');
            });
            res.render("admin/addAdministrator", {data: rows});
        }
    });
});
router.use("/addAdministratordata", function (req, res, next) {
    var aname = req.body.aname;
    var pass1 = req.body.pass1;
    var md5 = crypto.createHash('md5');
    md5.update(pass1);
    pass1 = md5.digest("hex");
    var addtime = new Date().toLocaleString();
    query(`insert into Administrator (aname,pass,addtime,del) values ('${aname}','${pass1}','${addtime}','0')`, function (error, rows, field) {
        if (error) {
            console.log(error);
        } else {
            res.redirect("/admin/addAdministrator");
        }
    })
});
router.use("/Administratordel", function (req, res, next) {
    var id = req.body.id;
    query(`update Administrator set del=1 where id='${id}'`, function (error, rows, field) {
        if (error) {

        } else {
            res.redirect("/admin/addAdministrator");
        }
    })
});
router.use("/updataAdministratordata", function (req, res, next) {
    var id = req.body.aid;
    var aname = req.body.aname;
    var pass1 = req.body.pass1;
    var md5 = crypto.createHash('md5');
    md5.update(pass1);
    pass1 = md5.digest("hex");
    var uptime = new Date().toLocaleString();
    query(`update Administrator set aname='${aname}',pass='${pass1}',uptime='${uptime}' where id='${id}'`, function (error, rows, field) {
        if (error) {
            console.log(error);
        } else {
            res.redirect("/admin/addAdministrator");
        }
    })
});

router.use("/ceshi", function (req, res, next) {
    query(`SELECT a.id,a.cname,b.sname FROM class as a,student as b where a.id=b.c_id`, function (error, rows, field) {
        if (error) {
            console.log(error);
        } else {
            console.log(rows);
        }
    })
});

/*上传文件*/

router.post('/upload', upload.single('file'), function (req, res, next) {
    if (req.file) {
        var c_id = req.body.c_id;
        var path = req.file.path;//当前文件目录
        var obj = xlsx.parse(fs.readFileSync(path));
        var pass1 = "123456";
        var md5 = crypto.createHash('md5');
        md5.update(pass1);
        pass1 = md5.digest("hex");
        var addtime = new Date().toLocaleString();
        var data = obj[0].data;
        var genre;

        query(`select * from class where del=0 and id=${c_id}`, function (error, rows, field) {
            if (error) {
                console.log(error);
            } else {
                //组合学号
                var date = new Date();
                /*年*/
                var y = date.getFullYear().toString();
                var m = date.getMonth() + 1;
                /*月份*/
                if (m < 10) {
                    m = "0" + m;
                }
                m = m.toString();
                /*专业  genre*/
                genre = rows[0].genre.toString();
                /*班级 c_id*/
                if (c_id < 10 && c_id > 0) {
                    c_id = "000" + c_id;
                } else if (c_id >= 10 && c_id < 100) {
                    c_id = "00" + c_id;
                } else if (c_id >= 100 && c_id < 1000) {
                    c_id = "0" + c_id;
                }
                c_id = c_id.toString();

                for (var i = 0; i < data.length; i++) {
                    var sname = data[i][0];
                    var phone = data[i][7];
                    if (i < 9 && i >= 0) {
                        var j = "00" + (i + 1);
                    } else if (i >= 9 && i < 100) {
                        var j = "0" + (i + 1);
                    } else {
                        j = (i + 1).toString()
                    }
                    var stdnum = y + m + genre + c_id + j;
                    query(`insert into student (c_id,del,stdnum,sname,phone,addtime,pass) values('${c_id}',0,'${stdnum}','${sname}','${phone}','${addtime}','${pass1}')`, function (error, rows, field) {
                        if (error) {
                            console.log(error);
                        } else {
                        }
                    })
                }
                res.redirect('/admin/addclass');
            }

        });
    }
});

router.get("/show/:c_id", function (req, res, next) {
    var c_id = req.params.c_id;
    query(`select * from student where c_id=${c_id}`, function (error, rows, field) {
        if (error) {
            console.log(error);
        } else {
            res.render("admin/show", {data: rows});
        }
    });
});
module.exports = router;

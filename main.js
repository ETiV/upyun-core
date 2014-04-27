/**
 * Created by ETiV on 4/27/14.
 */
'use strict';

(function () {
  /**
   * CONST of UPYUN API HOSTS
   * @type {string[]}
   */
  var API_HOSTS = [
    'v0.api.upyun.com',
    'v1.api.upyun.com',
    'v2.api.upyun.com',
    'v3.api.upyun.com'
  ];

  //noinspection JSUnusedLocalSymbols
  /**
   * CONST of Response Headers
   * @type {Object} Dictionary of response header and body
   */
  var GENERAL_STATUS_HEADER = {
    '200:ok': '操作成功',
    // <h1>400 Bad Request</h1>Need a bucket name
    '400:badrequest': '错误请求(如 URL 缺少空间名)',
    // ??
    '401:unauthorized': '访问未授权',
    // <h1>401 Unauthorized</h1>Sign error (sign = md5(METHOD&URI&DATE&CONTENT_LENGTH&MD5(PASSWORD)))
    '401:signerror': '签名错误(操作员和密码,或签名格式错误)',
    // <h1>401 Unauthorized</h1>Sign error (sign = md5(METHOD&URI&DATE&CONTENT_LENGTH&MD5(PASSWORD))) , Need Date Header!
    '401:needdateheader': '发起的请求缺少 Date 头信息',
    // <h1>401 Unauthorized</h1>Sign error (sign = md5(METHOD&URI&DATE&CONTENT_LENGTH&MD5(PASSWORD))) , Date offset error!
    '401:dateoffseterror': '发起请求的服务器时间错误，请检查服务器时间是否与世界时间一致',
    // ?? 403 Not Access
    '403:notaccess': '权限错误(如非图片文件上传到图片空间)',
    '403:filesizetoomax': '单个文件超出大小(100MB 以内)',
    '403:notapicturefile': '图片类空间错误码，非图片文件或图片文件格式错误。针对图片空间只允许上传 jpg/png/gif/bmp/tif 格式。',
    '403:picturesizetoomax': '图片类空间错误码，图片尺寸太大。针对图片空间，图片总像素在 200000000 以内。',
    '403:bucketfull': '空间已用满',
    '403:bucketblocked': '空间被禁用,请联系管理员',
    '403:userblocked': '操作员被禁用',
    '403:imagerotateinvalidparameters': '图片旋转参数错误',
    '403:imagecropinvalidparameters': '图片裁剪参数错误',
    // 404 Not Found
    '404:notfound': '获取文件或目录不存在；上传文件或目录时上级目录不存在',
    // 406 Not Acceptable(path)
    '406:notacceptable(path)': '目录错误（创建目录时已存在同名文件；或上传文件时存在同名目录)',
    '503:systemerror': '系统错误'
  };

  /**
   * Libraries and helper functions
   */
  var request = require('request');
  var async = require('async');
  var lib_path = require('path');
  var lib_crypto = require('crypto');
  var lib_util = require('util');

  var str_gmt = function () {
    return (new Date()).toUTCString();
  };

  var str_md5 = function (buffer) {
    var md5 = lib_crypto.createHash('md5');
    md5.update(buffer);
    return md5.digest('hex');
  };

  var str_signature = function (method, uri, date_gmt, buffer_length, password) {
    return str_md5(
        new Buffer(
                method + '&' + uri + '&' + date_gmt + '&' + String(buffer_length) + '&' + str_md5(new Buffer(String(password)))
        )
    );
  };

  var str_signature_purge = function (url_list, bucket, date_gmt, password) {
    var urls = url_list.join('\n');
    var token = str_md5(new Buffer(password));
    return str_md5(new Buffer(urls + '&' + bucket + '&' + date_gmt + '&' + token));
  };

  /**
   * do access to UPYUN REST API
   * @param {String} method
   * @param {String} uri
   * @param {Buffer|Function} [buffer]
   * @param {Object|Function} [headers]
   * @param {Function} cb
   */
  var do_access = function (method, uri, buffer, headers, cb) {
    if (typeof cb !== 'function') {
      cb = function () {
      };
    }

    if (arguments.length >= 4 && !(buffer instanceof Buffer)) {
      cb(new Error('Local Status: 0x80007F11\tBody: Argument 3 Must Be An Instance Of Buffer.'));
      return;
    }

    if (arguments.length < 3) {
      cb(new Error('Local Status: 0x80007F12\tBody: No Enough Arguments To Access UPYun API.'));
      return;
    }

    if (arguments.length === 3) {
      if (typeof buffer === 'function') {
        cb = buffer;
        buffer = null;
        headers = null;
      }
    }

    if (arguments.length === 4) {
      if (typeof headers === 'function') {
        cb = headers;
        headers = null;
      }
    }

    method = method.toUpperCase();
    headers = headers || {};

    var date_gmt = str_gmt();

    buffer = buffer || [];

    var signature = str_signature(method, uri, date_gmt, buffer.length, this.pass);

    // console.log(':: DEBUG :: do_access -> signature', signature);

    //noinspection JSUndefinedPropertyAssignment
    headers.Date = date_gmt;
    //noinspection JSUndefinedPropertyAssignment
    headers.Authorization = 'UpYun ' + this.user + ':' + signature;

    request({
      method: method,
      uri: 'http://' + this.host + uri,
      body: buffer.length > 0 ? buffer : undefined,
      headers: headers
    }, function (req, resp, body) {
      // callback
      // console.log(':: DEBUG :: do_access -> request.callback -> body =', body);
      if (!resp) {
        cb(new Error('Local Status: 0x80007FFF\tBody: Network Error.'));
        return;
      }
      var status = resp.statusCode;
      if (status === 200) {
        cb(null, resp.headers, body);
      } else {
        body = 'HTTP Status: ' + status + '\tBody: ' + body;
        cb(new Error(body));
      }
      // console.log(resp.headers);
    });
  };

  var UPYUN = function (bucket, user, pass) {
    this.bucket = bucket;
    this.user = user;
    this.pass = pass;

    this.host = API_HOSTS[0];
    this.validate = false;

    this.iDOReallyWantToDestroyDirectories = false;
  };

  //noinspection JSUnusedGlobalSymbols
  /**
   * Write(Upload) some contents to a certain path
   * @param {String} path
   * @param {String|Buffer} buffer
   * @param {Function} cb
   */
  UPYUN.prototype.writeFile = function (path, buffer, cb) {
    var headers = {};

    if (typeof buffer === 'string') {
      buffer = new Buffer(buffer);
    }

    if (this.validate) {
      headers['content-md5'] = str_md5(buffer);
    }

    var dirs = path.split('/');
    var depth = 0;
    for (var i = 0; i < dirs.length; i++) {
      if (dirs[i] !== '') {
        depth++;
      }
    }

    if (depth - 1 > 10) {
      cb('Too Many Directories. The Dirs Depth Should Not Larger Than 10.');
      return;
    }

    headers.mkdir = 'true';

    if (typeof cb !== 'function') {
      cb = function () {
      };
    }

    if (path[0] !== '/') {
      path = lib_path.join('/', path);
    }

    do_access.apply(this, [
          'PUT', '/' + this.bucket + path,
          buffer, headers, function (err) {
            cb(err);
            // console.log(':: DEBUG :: writeFile -> callback -> err =', err);
          }
        ]
    );
  };

  //noinspection JSUnusedGlobalSymbols
  /**
   * Fetch(Download) a certain file at the path
   * @param {String} path
   * @param {Function} cb
   */
  UPYUN.prototype.fetchFile = function (path, cb) {
    if (typeof cb !== 'function') {
      cb = function () {
      };
    }
    if (path[0] !== '/') {
      path = lib_path.join('/', path);
    }

    do_access.apply(this, [
      'GET', '/' + this.bucket + path,
      function (err, headers /* useless */, body) {
        cb(err, body || '');
        // console.log(':: DEBUG :: fetchFile -> callback -> err =', err);
      }
    ]);
  };

  //noinspection JSUnusedGlobalSymbols
  /**
   * Inspect a certain file or directory by given path
   * @param {String} path can be a path of file or directory
   * @param {Function} cb
   */
  UPYUN.prototype.inspect = function (path, cb) {
    if (typeof cb !== 'function') {
      cb = function () {
      };
    }
    if (path[0] !== '/') {
      path = lib_path.join('/', path);
    }

    do_access.apply(this, [
      'HEAD', '/' + this.bucket + path,
      function (err, headers/*, body /* useless */) {

        if (err) {
          cb(err);
          return;
        }

        /**
         * headers when the target is a Folder
         *  'x-upyun-file-type': 'folder',
         *  'x-upyun-file-date': '1396411022'
         */
        /**
         * headers when the target is a File
         *  'x-upyun-file-type': 'file',
         *  'x-upyun-file-size': '5',
         *  'x-upyun-file-date': '1398563107'
         */

        var entity = {};
        entity.path = path;
        entity.name = lib_path.basename(path);
        entity.type = String(headers['x-upyun-file-type']).toLowerCase();
        entity.time = headers['x-upyun-file-date'];

        if (!!headers['x-upyun-file-size']) {
          entity.size = headers['x-upyun-file-size'];
        } else {
          entity.size = 0;
        }

        cb(err, entity);
        // console.log(':: DEBUG :: inspect -> callback -> err =', err);
        // console.log(':: DEBUG :: inspect -> callback -> headers =', headers);
      }
    ]);
  };

  //noinspection JSUnusedGlobalSymbols
  /**
   * Remove a certain file at the path
   * @param {String} path
   * @param {Function} cb
   */
  UPYUN.prototype.removeFile = function (path, cb) {
    if (typeof cb !== 'function') {
      cb = function () {
      };
    }
    if (path[0] !== '/') {
      path = lib_path.join('/', path);
    }

    do_access.apply(this, [
      'DELETE', '/' + this.bucket + path,
      function (err/*, headers /* useless *//*, body /* useless */) {
        cb(err);
        // console.log(':: DEBUG :: removeFile -> callback -> err =', err);
      }
    ]);
  };

  //noinspection JSUnusedGlobalSymbols
  /**
   * Create directories by a full path, with 10 levels of max depth
   * @param {String} path
   * @param {Function} cb
   */
  UPYUN.prototype.createDirs = function (path, cb) {
    var headers = {};

    if (typeof cb !== 'function') {
      cb = function () {
      };
    }
    if (path[0] !== '/') {
      path = lib_path.join('/', path);
    }
    if (path[path.length - 1] !== '/') {
      path = lib_path.join(path, '/');
    }

    headers.folder = 'true';
    headers.mkdir = 'true';

    var dirs = path.split('/');
    var depth = 0;
    for (var i = 0; i < dirs.length; i++) {
      if (dirs[i] !== '') {
        depth++;
      }
    }

    if (depth > 10) {
      // should trigger an Error ?
      cb(new Error('Local Status: 0x80007F03\tBody: Too Many Directories. The Dirs Depth Should Not Larger Than 10.'));
      return;
    }

    do_access.apply(this, [
      'POST', '/' + this.bucket + path,
      new Buffer(0), headers,
      function (err/*, headers /* useless *//*, body /* useless */) {
        cb(err);
        // console.log(':: DEBUG :: createDirs -> callback -> err =', err);
      }
    ]);

  };

  //noinspection JSUnusedGlobalSymbols
  /**
   * Remove a certain directory at the path, non-recursive
   * @param {String} path
   * @param {Function} cb
   */
  UPYUN.prototype.removeDir = function (path, cb) {
    if (typeof cb !== 'function') {
      cb = function () {
      };
    }
    if (path[0] !== '/') {
      path = lib_path.join('/', path);
    }
    if (path[path.length - 1] !== '/') {
      path = lib_path.join(path, '/');
    }

    do_access.apply(this, [
      'DELETE', '/' + this.bucket + path,
      function (err/*, headers /* useless *//*, body /* useless */) {
        cb(err);
        // console.log(':: DEBUG :: removeDir -> callback -> err =', err);
      }
    ]);
  };

  //noinspection JSUnusedGlobalSymbols
  /**
   * Get all the directory contents, including files and sub-dirs
   * @param {String} path
   * @param {Function} cb
   */
  UPYUN.prototype.listDir = function (path, cb) {
    if (typeof cb !== 'function') {
      cb = function () {
      };
    }
    if (path[0] !== '/') {
      path = lib_path.join('/', path);
    }
    if (path[path.length - 1] !== '/') {
      path = lib_path.join(path, '/');
    }

    do_access.apply(this, [
      'GET', '/' + this.bucket + path,
      function (err, headers /* useless */, body) {

        if (err) {
          cb(err);
          return;
        }

        /**
         * {FILE_NAME}\t{'N'(文件)|'F'(目录)}\t{FILE_SIZE in byte}\t{LAST_MODIFIED_TIME in timestamp}\n
         */

        var contents = body.split('\n');
        var list = [];
        for (var i = 0; i < contents.length; i++) {
          var entity = {};
          var pieces = contents[i].split('\t');
          entity.name = pieces[0];

          if (entity.name === '') {
            continue;
          }

          entity.path = lib_path.join(path, entity.name);

          if (pieces[1] === 'N') {
            entity.type = UPYUN.TYPES.FILE;
          } else if (pieces[1] === 'F') {
            entity.type = UPYUN.TYPES.FOLDER;
          }

          entity.size = pieces[2];
          entity.time = pieces[3];

          list.push(entity);
        }

        cb(err, list);
        // console.log(':: DEBUG :: listDir -> callback -> err =', err);
        // console.log(':: DEBUG :: listDir -> callback -> body =', body);
      }
    ]);
  };

  //noinspection JSUnusedGlobalSymbols
  /**
   * Destroy the directory from the given path
   * @param {String} path
   * @param {Function} cb
   * @param {Number} [_depth]
   */
  UPYUN.prototype.destroyDir = function (path, cb, _depth) {
    if (typeof cb !== 'function') {
      cb = function () {
      };
    }
    if (path[0] !== '/') {
      path = lib_path.join('/', path);
    }
    if (path[path.length - 1] !== '/') {
      path = lib_path.join(path, '/');
    }

    if (typeof _depth === 'number') {
      _depth++;
    } else {
      _depth = 0;
    }

    // to protect the root directory
    if (path === '/') {
      cb(new Error('Local Status: 0x80007F01\tBody: Destroy Root Directory "/" Is NOT ALLOWED!!!'));
      return;
    }

    if (this.iDOReallyWantToDestroyDirectories === false) {
      cb(new Error('Local Status: 0x80007F0F\tBody: DO YOU REALLY WANT TO DESTROY DIRECTORIES? PLEASE SET upyunObj.iDOReallyWantToDestroyDirectories = true.'));
      return;
    }

    var self = this;

    this.listDir(path, function (err, list) {
      if (err) {
        // reset iDOReallyWantToDestroyDirectories = false
        // to force the user set this protect lock again
        if (_depth === 0) {
          self.iDOReallyWantToDestroyDirectories = false;
        }

        cb(err);
        // console.log(':: DEBUG :: destroyDir -> listDir -> err =', err);
      } else {
        async.eachSeries(
            list,
            function (entity, _cb) {
              // console.log(':: DEBUG :: destroyDir -> async.eachSeries -> entity =', entity);

              if (entity.type === UPYUN.TYPES.FILE) {
                self.removeFile(entity.path, function (err) {
                  _cb(err);
                  // console.log(':: DEBUG :: destroyDir -> async.eachSeries -> removeFile -> err =', err);
                });
              } else {
                self.destroyDir(entity.path, function (err) {
                  _cb(err);
                  // console.log(':: DEBUG :: destroyDir -> async.eachSeries -> destroyDir -> err =', err);
                }, _depth);
              }
            },
            function (err) {
              // reset iDOReallyWantToDestroyDirectories = false
              // to force the user set this protect lock again
              if (_depth === 0) {
                self.iDOReallyWantToDestroyDirectories = false;
              }

              if (err) {
                cb(err);
                // console.log(':: DEBUG :: destroyDir -> async.eachSeries -> callback -> err =', err);
                return;
              }
              self.removeDir(path, function (err) {
                cb(err);
                // console.log(':: DEBUG :: destroyDir -> async.eachSeries -> callback -> removeDir -> err =', err);
              });
            }
        );
      }
    });
  };

  //noinspection JSUnusedGlobalSymbols
  /**
   * Get the bytes used by current bucket
   * @param {Function} cb ({Error}err, {Integer}bytes)
   */
  UPYUN.prototype.bucketUsage = function (cb) {
    if (typeof cb !== 'function') {
      cb = function () {
      };
    }

    do_access.apply(this, [
      'GET', '/' + this.bucket + '/?usage',
      function (err, headers /* useless */, body) {
        if (typeof body !== 'number') {
          body = 0;
        } else {
          body = parseInt(body);
        }
        cb(err, body);
        // console.log(':: DEBUG :: bucketUsage -> callback -> err =', err);

        /**
         * bucket usage in byte
         */
        // console.log(':: DEBUG :: bucketUsage -> callback -> body =', body);
      }
    ]);
  };

  //noinspection JSUnusedGlobalSymbols
  /**
   * UPYUN Cache purge API
   * @param {Array} url_list
   * @param {Function} cb
   */
  UPYUN.prototype.purge = function (url_list, cb) {
    if (typeof cb !== 'function') {
      cb = function () {
      };
    }

    if (!lib_util.isArray(url_list)) {
      cb(new Error('Local Status: 0x80007F31  The URL List Must Be An Array.'));
      return;
    }

    var date_gmt = str_gmt();

    var signature = str_signature_purge(url_list, this.bucket, date_gmt, this.pass);
    request.post('http://purge.upyun.com/purge/', {
      headers: {
        Authorization: 'UpYun ' + this.bucket + ':' + this.user + ':' + signature,
        Date: date_gmt
      },
      form: {
        'purge': url_list.join('\n')
      }
    }, function (req, resp, body) {

      if (!resp) {
        cb(new Error('Local Status: 0x80007FFF\tBody: Network Error.'));
        return;
      }

      var status = resp.statusCode;
      if (status === 200) {
        var json = {};
        try {
          json = JSON.parse(body);
        } catch (e) {
          cb(new Error('Local Status: 0x80007F32  Purge Response Body Known'));
          return;
        }
        //noinspection JSUnresolvedVariable
        cb(null, json.invalid_domain_of_url || []);
      } else {
        body = 'HTTP Status: ' + status + '\tBody: ' + body;
        cb(new Error(body));
      }
    });
  };

  //noinspection JSUnusedGlobalSymbols
  /**
   * Set whether to use message-digest-5 to validate uploaded contents
   * Turn this on will take more time to calculate the MD5 of the buffer
   *
   * @param {Boolean} boolean
   */
  UPYUN.prototype.setValidate = function (boolean) {
    this.validate = !!boolean;
  };

  //noinspection JSUnusedGlobalSymbols
  /**
   * Set which UPYUN API host to be used
   * @param {Integer} hostIndex Value Range: [0, 1, 2, 3]
   */
  UPYUN.prototype.setHost = function (hostIndex) {
    if (Math.floor(hostIndex) === hostIndex) {
      hostIndex = hostIndex % API_HOSTS.length;
    } else {
      hostIndex = 0;
    }

    this.host = API_HOSTS[ hostIndex ];
  };

  // export type constant
  UPYUN.TYPES = {
    FILE: 'file',
    FOLDER: 'folder'
  };

  module.exports = UPYUN;
})();
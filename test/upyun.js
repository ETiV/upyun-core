/*global describe, it */
/**
 * Created by ETiV on 4/27/14.
 */

'use strict';
describe('UPYUN Core', function () {

  var API_HOSTS = [
    'v0.api.upyun.com',
    'v1.api.upyun.com',
    'v2.api.upyun.com',
    'v3.api.upyun.com'
  ];

  var config = require('./config');
  var crypto = require('crypto');
  var lib_path = require('path');
  var UPYUN = require('../main');
  var upyun = new UPYUN(config.upyun.bucket, config.upyun.user, config.upyun.pass);

  var BASE_DIR = config.upyun.TEST_BASE_DIR || '_TEST_BASE_';

  var helper = {
    random_word: require('random-word'),
    random_contents: function (count) {
      var arr = [];
      if (!count) {
        count = Math.random() * 1000;
      }
      for (var i = 0; i < Math.abs(count); i++) {
        arr.push(helper.random_word());
      }
      return arr.join(' ');
    },
    random_hash: function () {
      var md5 = crypto.createHash('md5');
      md5.update(Math.floor(0xFFFFFFFF * Math.random()).toString(36));
      md5.update(Math.floor(0xFFFFFFFF * Math.random()).toString(36));
      md5.update(Math.floor(0xFFFFFFFF * Math.random()).toString(36));
      md5.update(Math.floor(0xFFFFFFFF * Math.random()).toString(36));
      return md5.digest('hex').substr(0, 8);
    }
  };

  describe('Basic Properties', function () {
    describe('# setValidate()', function () {

      it('by default validate should be false', function () {
        upyun.validate.should.equal(false);
      });

      it('should equal', function () {
        upyun.setValidate(true);
        upyun.validate.should.equal(true);
        upyun.setValidate(false);
        upyun.validate.should.equal(false);
      });
    });

    describe('# setHost()', function () {
      it('should change to given API HOST', function () {
        for (var i = 0; i < API_HOSTS.length; i++) {
          upyun.setHost(i);
          upyun.host.should.equal(API_HOSTS[i]);
        }
      });
    });
  });

  describe('File Operations', function () {
    var contents = helper.random_contents();
    var path = lib_path.join(BASE_DIR, helper.random_hash(), helper.random_hash(), helper.random_hash() + '.txt');

    describe('# writeFile()', function () {
      it('should have no error', function (done) {
        upyun.writeFile(path, contents, done);
      });
    });

    describe('# fetchFile()', function () {
      it('should have no error, and online contents equals to the local contents', function (done) {
        upyun.fetchFile(path, function (err, content) {
          if (err) {
            done(err);
          } else {
            content.should.equal(contents);
            done();
          }
        });
      });
    });

    describe('# inspect()', function () {
      it('should have no error, and online entity should be a file', function (done) {
        upyun.inspect(path, function (err, entity) {
          if (err) {
            done(err);
          } else {
            entity.type.should.equal(UPYUN.TYPES.FILE);
            done();
          }
        });
      });

      it('type of the dir name should be a folder', function (done) {
        upyun.inspect(lib_path.dirname(path), function (err, entity) {
          if (err) {
            done(err);
          } else {
            entity.type.should.equal(UPYUN.TYPES.FOLDER);
            done();
          }
        });
      });
    });

    describe('# removeFile()', function () {
      it('should have no error', function (done) {
        upyun.removeFile(path, done);
      });

      it('should have 404 error', function (done) {
        upyun.fetchFile(path, function (err) {
          err.message.should.match(/^HTTP Status: 404\t/);
          done();
        });
      });
    });

  });

  describe('Directory Operations', function () {

    var dir_name = lib_path.join(BASE_DIR, helper.random_hash());
    var dir_entity = null;

    describe('# createDirs()', function () {
      it('should have no error', function (done) {
        upyun.createDirs(dir_name, done);
      });

      it('type of entity should be a folder', function (done) {
        upyun.inspect(dir_name, function (err, entity) {
          if (err) {
            done(err);
          } else {
            dir_entity = entity;
            entity.type.should.equal(UPYUN.TYPES.FOLDER);
            done();
          }
        });
      });
    });

    describe('# listDir()', function () {
      it('the base directory "_" should contains the dir_name', function (done) {
        upyun.listDir(lib_path.join(BASE_DIR), function (err, list) {
          if (err) {
            done(err);
          } else {
            //noinspection JSUnresolvedFunction
            list.should.containEql(dir_entity);
            done();
          }
        });
      });
    });

    describe('# removeDir()', function () {
      it('should have no error', function (done) {
        upyun.removeDir(dir_name, done);
      });

      it('should have a 404 error', function (done) {
        upyun.inspect(dir_name, function (err) {
          err.message.should.match(/^HTTP Status: 404\t/);
          done();
        });
      });
    });

  });

  describe('Recursively Remove Directories', function () {
    describe('# destroyDirs()', function () {

      it('the ROOT "/" directory should not be destroyed', function (done) {
        upyun.destroyDir('/', function (err) {
          err.message.should.match(/^Local Status: 0x80007F01\s/);
          done();
        });
      });

      it('if did not set the protect lock "iDOReallyWantToDestroyDirectories", the destroy will return false',
          function (done) {
            upyun.destroyDir(lib_path.join(BASE_DIR), function (err) {
              err.message.should.match(/^Local Status: 0x80007F0F\s/);
              done();
            });
          }
      );

      it('the test base dir "_" will be destroyed, and the protect lock will be reset to false.', function (done) {
        upyun.iDOReallyWantToDestroyDirectories = true;
        upyun.destroyDir(lib_path.join(BASE_DIR), function (err) {
          if (err) {
            done(err);
          } else {
            upyun.iDOReallyWantToDestroyDirectories.should.equal(false);
            done();
          }
        });
      });

    });
  });

});
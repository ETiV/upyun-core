/**
 * Created by ETiV on 4/27/14.
 */

module.exports = function (grunt) {
  'use strict';

  //noinspection JSUnresolvedFunction
  grunt.initConfig({
    mochaTest: {
      test: {
        options: {
          mocha: require('mocha'),
          require: 'should',
          timeout: 60000,
          slow: 2000,
          clearRequireCache: true,
          reporter: 'spec'
        },
        src: ['test/**/*.js']
      }
    },
    watch: {
      test: {
        options: {
          spawn: false
        },
        files: 'test/**/*.js',
        tasks: ['test']
      }
    }
  });

  grunt.loadNpmTasks('grunt-mocha-test');
  grunt.loadNpmTasks('grunt-contrib-watch');

  // grunt.registerTask('watch', ['watch']);
  grunt.registerTask('test', ['mochaTest:test']);
};
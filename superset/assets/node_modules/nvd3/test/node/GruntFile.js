module.exports = function(grunt) {
  grunt.initConfig({
    browserify: {
      js: {
        src: './nodeTest.js', dest: './build/nodeTest.js',
      },
    },
    copy: {
      all: {
        src: ['../../build/nv.d3.css'], dest: './build/nv.d3.css',
      },
    },
  });
  grunt.loadNpmTasks('grunt-browserify');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.registerTask('default', ['browserify', 'copy']);
};

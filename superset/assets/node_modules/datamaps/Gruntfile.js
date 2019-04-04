module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    replace: {
      world: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.world.js',
        replacements: [{
          from: '\'__WORLD__\'',
          to: '<%= grunt.file.read("src/js/data/world.topo.json") %>'
        }]
      },
      worldHiRes: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.world.hires.js',
        replacements: [{
          from: '\'__WORLD__\'',
          to: '<%= grunt.file.read("src/js/data/world.hires.topo.json") %>'
        }]
      },
      usa: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.usa.js',
        replacements: [{
          from: '\'__USA__\'',
          to: '<%= grunt.file.read("src/js/data/usa.topo.json") %>'
        }]
      },
      all: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.all.js',
        replacements: [{
          from: '\'__USA__\'',
          to: '<%= grunt.file.read("src/js/data/usa.topo.json") %>'
        }, {
          from: '\'__WORLD__\'',
          to: '<%= grunt.file.read("src/js/data/world.topo.json") %>'
        }]
      },
      allHiRes: {
        src: ['src/js/datamaps.js'],
        dest: 'src/rel/datamaps.all.hires.js',
        replacements: [{
          from: '\'__USA__\'',
          to: '<%= grunt.file.read("src/js/data/usa.topo.json") %>'
        }, {
          from: '\'__WORLD__\'',
          to: '<%= grunt.file.read("src/js/data/world.hires.topo.json") %>'
        }]
      }
    },
    watch: {
      datamap: {
        files: ['src/js/datamaps.js'],
        tasks: ['replace'],
    }
  },
   uglify: {
      dist: {
        files: {
          'src/rel/datamaps.world.min.js': ['src/rel/datamaps.world.js'],
          'src/rel/datamaps.world.hires.min.js': ['src/rel/datamaps.world.hires.js'],
          'src/rel/datamaps.usa.min.js': ['src/rel/datamaps.usa.js'],
          'src/rel/datamaps.all.min.js': ['src/rel/datamaps.all.js'],
          'src/rel/datamaps.all.hires.min.js': ['src/rel/datamaps.all.hires.js'],
          'src/rel/datamaps.none.min.js': ['src/js/datamaps.js']
        }
      }
    },
    jasmine: {
      all: [
        'src/tests/SpecRunner_StatesGlobal.html',
        'src/tests/SpecRunner_StatesStripped.html',
        'src/tests/SpecRunner_CountriesStripped.html',
        'src/tests/SpecRunner_CountriesGlobal.html',
        'src/tests/SpecRunner_AllStripped.html',
        'src/tests/SpecRunner_AllGlobal.html',
        'src/tests/SpecRunner_jQueryPlugin.html'
      ]
    },
    copy: {
      all: {
        files: [
          { src: ['src/rel/*.js'], dest: './dist', flatten: true, expand: true }
        ]
      }
    },
    clean: {
      release: ['.dist/datamaps.*.js']
    },
    sync: {
      options: {
        include: ['name', 'version', 'main', 'dependencies']
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-jasmine');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-text-replace');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-sync-pkg');


  grunt.registerTask('dev', ['replace']);
  grunt.registerTask('build', ['replace', 'uglify:dist', 'copy', 'sync']);

};

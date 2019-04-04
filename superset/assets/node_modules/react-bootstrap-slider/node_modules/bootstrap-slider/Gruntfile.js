/*global module:false*/
module.exports = function(grunt) {

  var packageJSON = grunt.file.readJSON('package.json');
  var bumpFiles = ["package.json", "bower.json", "composer.json"];
  var commitFiles = bumpFiles.concat(["./dist/*"]);

  // Project configuration.
  grunt.initConfig({
    // Metadata
    pkg: packageJSON,
    // Task configuration.
    header: {
      dist: {
        options: {
          text: "/*! =======================================================\n                      VERSION  <%= pkg.version %>              \n========================================================= */"
        },
        files: {
          '<%= pkg.gruntConfig.dist.js %>': '<%= pkg.gruntConfig.temp.js %>',
          '<%= pkg.gruntConfig.dist.jsMin %>': '<%= pkg.gruntConfig.temp.jsMin %>',
          '<%= pkg.gruntConfig.dist.css %>': '<%= pkg.gruntConfig.temp.css %>',
          '<%= pkg.gruntConfig.dist.cssMin %>': '<%= pkg.gruntConfig.temp.cssMin %>'
        }
      }
    },
    uglify: {
      options: {
        preserveComments: 'some'
      },
      dist: {
        src: '<%= pkg.gruntConfig.temp.js %>',
        dest: '<%= pkg.gruntConfig.temp.jsMin %>'
      }
    },
    babel: {
      options: {
        presets: ['es2015']
      },
      dist: {
        src: '<%= pkg.gruntConfig.js.slider %>',
        dest: '<%= pkg.gruntConfig.temp.js %>'
      }
    },
    jshint: {
      ignore_warning: {
        options: {
          '-W099': true
        },
        src: '<%= pkg.gruntConfig.js.slider %>'
      },
      options: {
        esnext: true,
        curly: true,
        eqeqeq: true,
        immed: true,
        latedef: false,
        newcap: true,
        noarg: true,
        sub: true,
        undef: true,
        unused: true,
        boss: true,
        eqnull: true,
        browser: true,
        globals: {
          $ : true,
          Modernizr : true,
          console: true,
          define: true,
          module: true,
          require: true
        },
        "-W099": true
      },
      gruntfile: {
        src: 'Gruntfile.js'
      },
      js: {
        src: '<%= pkg.gruntConfig.js.slider %>'
      },
      spec : {
        src: '<%= pkg.gruntConfig.spec %>',
        options : {
          globals : {
            document: true,
            console: false,
            Slider: false,
            $: false,
            jQuery: false,
            _: false,
            _V_: false,
            afterEach: false,
            beforeEach: false,
            confirm: false,
            context: false,
            describe: false,
            expect: false,
            it: false,
            jasmine: false,
            JSHINT: false,
            mostRecentAjaxRequest: false,
            qq: false,
            runs: false,
            spyOn: false,
            spyOnEvent: false,
            waitsFor: false,
            xdescribe: false
          }
        }
      }
    },
    sasslint: {
      options: {
        configFile: './.sass-lint.yml',
      },
      target: ['./src/sass/**/*.scss']
    },
    lesslint: {
      src: ['./src/less/bootstrap-slider.less']
    },
    jasmine : {
      src : '<%= pkg.gruntConfig.temp.js %>',
      options : {
        specs : '<%= pkg.gruntConfig.spec %>',
        vendor : ['<%= pkg.gruntConfig.js.jquery %>', '<%= pkg.gruntConfig.js.bindPolyfill %>'],
        styles : ['<%= pkg.gruntConfig.css.bootstrap %>', '<%= pkg.gruntConfig.temp.css %>'],
        template : '<%= pkg.gruntConfig.tpl.SpecRunner %>'
      }
    },
    template : {
      'generate-index-page' : {
        options : {
          data : {
            js : {
              highlightjs: '<%= pkg.gruntConfig.js.highlightjs %>',
              modernizr : '<%= pkg.gruntConfig.js.modernizr %>',
              jquery : '<%= pkg.gruntConfig.js.jquery %>',
              slider : '<%= pkg.gruntConfig.temp.js %>'
            },
            css : {
              highlightjs: '<%= pkg.gruntConfig.css.highlightjs %>',
              bootstrap : '<%= pkg.gruntConfig.css.bootstrap %>',
              slider : '<%= pkg.gruntConfig.temp.css %>'
            }
          }
        },
        files : {
          'index.html' : ['<%= pkg.gruntConfig.tpl.index %>']
        }
      },
      'generate-gh-pages' : {
        options : {
          data : {
            js : {
              highlightjs: '<%= pkg.gruntConfig.js.highlightjs %>',
              modernizr : '<%= pkg.gruntConfig.js.modernizr %>',
              jquery : '<%= pkg.gruntConfig.js.jquery %>',
              slider : 'js/bootstrap-slider.js'
            },
            css : {
              highlightjs: '<%= pkg.gruntConfig.css.highlightjs %>',
              bootstrap : '<%= pkg.gruntConfig.css.bootstrap %>',
              slider : 'css/bootstrap-slider.css'
            }
          }
        },
        files : {
          'index.html' : ['<%= pkg.gruntConfig.tpl.index %>']
        }
      }
    },
    watch: {
      options: {
        livereload: true
      },
      js: {
        files: '<%= pkg.gruntConfig.js.slider %>',
        tasks: ['jshint:js', 'babel', 'jasmine']
      },
      gruntfile: {
        files: '<%= jshint.gruntfile %>',
        tasks: ['jshint:gruntfile']
      },
      spec: {
        files: '<%= pkg.gruntConfig.spec %>',
        tasks: ['jshint:spec', 'jasmine:src']
      },
      css: {
        files: [
          '<%= pkg.gruntConfig.less.slider %>',
          '<%= pkg.gruntConfig.less.rules %>',
          '<%= pkg.gruntConfig.less.variables %>'
        ],
        tasks: ['less:development']
      },
      index: {
        files: '<%= pkg.gruntConfig.tpl.index %>',
        tasks: ['template:generate-index-page']
      }
    },
    connect: {
      server: {
        options: {
          port: "<%= pkg.gruntConfig.devPort %>"
        }
      }
    },
    open : {
      development : {
        path: 'http://localhost:<%= connect.server.options.port %>'
      }
    },
    less: {
      options: {
        paths: ["bower_components/bootstrap/less"]
      },
      development: {
        files: {
          '<%= pkg.gruntConfig.temp.css %>': '<%= pkg.gruntConfig.less.slider %>'
        }
      },
      production: {
        files: {
         '<%= pkg.gruntConfig.temp.css %>': '<%= pkg.gruntConfig.less.slider %>',
        }
      },
      "production-min": {
        options: {
          yuicompress: true
        },
        files: {
         '<%= pkg.gruntConfig.temp.cssMin %>': '<%= pkg.gruntConfig.less.slider %>'
        }
      }
    },
    clean: {
      dist: ["dist"],
      temp: ["temp"]
    },
    bump: {
      options: {
        files: bumpFiles,
        updateConfigs: [],
        commit: true,
        commitMessage: 'Release v%VERSION%',
        commitFiles: commitFiles,
        createTag: true,
        tagName: 'v%VERSION%',
        tagMessage: 'Version %VERSION%',
        push: false,
        pushTo: 'origin'
      }
    }
  });

  // These plugins provide necessary tasks.
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-jasmine');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-contrib-connect');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-less');
  grunt.loadNpmTasks('grunt-open');
  grunt.loadNpmTasks('grunt-template');
  grunt.loadNpmTasks('grunt-header');
  grunt.loadNpmTasks('grunt-bump');
  grunt.loadNpmTasks('grunt-babel');
  grunt.loadNpmTasks('grunt-sass-lint');
  grunt.loadNpmTasks('grunt-lesslint');

  // Create custom tasks
  grunt.registerTask('append-header', ['header', 'clean:temp']);
  grunt.registerTask('lint', [
    'jshint',
    'lesslint',
    'sasslint'
  ]);
  grunt.registerTask('test', [
    'babel',
    'less:development',
    'jasmine',
    'clean:temp'
  ]);
  grunt.registerTask('build', [
    'less:development',
    'test',
    'template:generate-index-page'
  ]);
  grunt.registerTask('build-gh-pages', [
    'less:development',
    'babel',
    'template:generate-gh-pages'
  ]);
  grunt.registerTask('dist', [
    'clean:dist',
    'less:production',
    'less:production-min',
    'babel',
    'uglify',
    'append-header'
  ]);
  grunt.registerTask('development', [
    'less:development',
    'babel',
    'template:generate-index-page',
    'connect',
    'open:development',
    'watch'
  ]);
  grunt.registerTask('production', ['dist']);
  grunt.registerTask('dev', 'development');
  grunt.registerTask('prod', 'production');
  grunt.registerTask('default', ['build']);

}; // End of module

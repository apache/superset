module.exports = function (config) {
    config.set({
        basePath: '',
        frameworks: ['mocha', 'chai'],
        concurrency: 1,

        files: [{
                pattern: 'spec/resources/**/*',
                included: false,
                served: true
            }, {
                pattern: 'bower_components/fontawesome/fonts/*.*',
                included: false,
                served: true
            }, {
                pattern: 'bower_components/fontawesome/css/*.*',
                included: false,
                served: true
            },

            'bower_components/jquery/dist/jquery.js',
            'bower_components/js-imagediff/imagediff.js',
            'test-lib/tesseract-1.0.10.js',

            'src/dom-to-image.js',
            'spec/dom-to-image.spec.js'
        ],

        exclude: [],
        preprocessors: {},
        reporters: ['mocha'],
        port: 9876,
        colors: true,
        logLevel: config.LOG_INFO,
        client: {
            captureConsole: true
        },
        autoWatch: true,
        browsers: ['chrome', 'Firefox'],
        customLaunchers: {
            chrome: {
                base: 'Chrome',
                flags: ['--no-sandbox']
            }
        },

        singleRun: false,
        browserNoActivityTimeout: 60000
    });
};

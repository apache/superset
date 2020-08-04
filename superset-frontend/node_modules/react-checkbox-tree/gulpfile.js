const autoprefixer = require('gulp-autoprefixer');
const browserSyncImport = require('browser-sync');
const cleanCss = require('gulp-clean-css');
const eslint = require('gulp-eslint');
const exec = require('gulp-exec');
const gulp = require('gulp');
const header = require('gulp-header');
const less = require('gulp-less');
const mocha = require('gulp-mocha');
const sass = require('gulp-sass');
const scsslint = require('gulp-scss-lint');
const webpack = require('webpack');
const webpackStream = require('webpack-stream');

const pkg = require('./package.json');
const testWebpackConfig = require('./webpack.test.config');
const webpackConfig = require('./webpack.config');

const banner = '/*! <%= pkg.name %> - v<%= pkg.version %> | <%= new Date().getFullYear() %> */\n';
const browserSync = browserSyncImport.create();

gulp.task('test-script-format', () => (
    gulp.src([
        './examples/src/**/*.js',
        './src/**/*.js',
        './test/**/*.js',
        './*.js',
    ])
        .pipe(eslint())
        .pipe(eslint.format())
        .pipe(eslint.failOnError())
));

gulp.task('test-script-mocha', () => (
    gulp.src(['./test/**/*.js'])
        .pipe(mocha({
            require: [
                '@babel/register',
                './test/setup.js',
            ],
        }))
));

gulp.task('test-script', gulp.series('test-script-format', 'test-script-mocha'));

gulp.task('build-script', gulp.series('test-script', () => (
    gulp.src(['./src/index.js'])
        .pipe(webpackStream(webpackConfig('node'), webpack))
        .pipe(header(banner, { pkg }))
        .pipe(gulp.dest('./lib/'))
)));

gulp.task('build-script-web', gulp.series('build-script', () => (
    gulp.src(['./src/index.js'])
        .pipe(webpackStream(webpackConfig('web'), webpack))
        .pipe(header(banner, { pkg }))
        .pipe(gulp.dest('./lib/'))
)));

gulp.task('build-style', () => (
    gulp.src('./src/scss/**/*.scss')
        .pipe(scsslint())
        .pipe(scsslint.failReporter())
        .pipe(sass({
            outputStyle: 'expanded',
        }).on('error', sass.logError))
        .pipe(autoprefixer({
            browsers: ['last 2 versions'],
        }))
        .pipe(gulp.dest('./lib'))
        .pipe(cleanCss())
        .pipe(gulp.dest('./.css-compare/scss'))
));

gulp.task('build-style-less', () => (
    gulp.src('./src/less/**/*.less')
        .pipe(less())
        .pipe(autoprefixer({
            browsers: ['last 2 versions'],
        }))
        .pipe(cleanCss())
        .pipe(gulp.dest('./.css-compare/less'))
));

gulp.task('compare-css-output', gulp.series(gulp.parallel('build-style', 'build-style-less'), () => (
    gulp.src('./gulpfile.js')
        .pipe(exec('cmp .css-compare/less/react-checkbox-tree.css .css-compare/scss/react-checkbox-tree.css'))
        .pipe(exec.reporter())
)));

gulp.task('build', gulp.series('build-script-web', 'compare-css-output'));

function buildExamplesScript(mode = 'development') {
    return gulp.src(['./examples/src/index.js'])
        .pipe(webpackStream({ ...testWebpackConfig, mode }, webpack))
        .pipe(gulp.dest('./examples/dist/'));
}

function buildExamplesStyle(minifyStyles = false) {
    let stream = gulp.src('./examples/src/scss/**/*.scss')
        .pipe(scsslint())
        .pipe(scsslint.failReporter())
        .pipe(sass({
            outputStyle: 'expanded',
        }).on('error', sass.logError))
        .pipe(autoprefixer({
            browsers: ['last 2 versions'],
        }));

    if (minifyStyles) {
        stream = stream.pipe(cleanCss());
    }

    return stream.pipe(gulp.dest('./examples/dist'));
}

gulp.task('build-examples-script', () => (
    buildExamplesScript().pipe(browserSync.stream())
));

gulp.task('build-examples-script-prod', () => (
    buildExamplesScript('production')
));

gulp.task('build-examples-style', () => (
    buildExamplesStyle().pipe(browserSync.stream())
));

gulp.task('build-examples-style-prod', () => (
    buildExamplesStyle(true)
));

gulp.task('build-examples-html', () => (
    gulp.src('./examples/src/index.html')
        .pipe(gulp.dest('./examples/dist/'))
        .pipe(browserSync.stream())
));

gulp.task('examples', gulp.series(gulp.parallel('build-examples-style', 'build-examples-script', 'build-examples-html'), () => {
    browserSync.init({ server: './examples/dist' });

    gulp.watch(['./src/js/**/*.js', './examples/src/**/*.js']).on('change', gulp.series('build-examples-script'));
    gulp.watch(['./src/scss/**/*.scss', './examples/src/**/*.scss']).on('change', gulp.series('build-examples-style'));
    gulp.watch(['./examples/src/**/*.html']).on('change', gulp.series('build-examples-html', browserSync.reload));
}));

gulp.task('default', gulp.series('build'));
gulp.task('build-gh-pages', gulp.parallel('build-examples-style-prod', 'build-examples-script-prod', 'build-examples-html'));

var lessTest = require('./less-test'),
    lessTester = lessTest(),
    path = require('path'),
    stylize = require('../lib/less-node/lessc-helper').stylize;

console.log('\n' + stylize('Less', 'underline') + '\n');

lessTester.prepBomTest();
var testMap = [
    [{}, 'namespacing/'],
    [{
        // TODO: Change this to rewriteUrls: 'all' once the relativeUrls option is removed
        relativeUrls: true,
        silent: true,
        javascriptEnabled: true,
        // Set explicitly for legacy tests for >3.0
        ieCompat: true
    }],
    [{
        math: 'strict-legacy',
        ieCompat: true
    }, 'math/strict-legacy/'],
    [{
        math: 'parens'
    }, 'math/strict/'],
    [{
        math: 'parens-division'
    }, 'math/parens-division/'],
    // Use legacy strictMath: true here to demonstrate it still works
    [{strictMath: true, strictUnits: true, javascriptEnabled: true}, 'errors/',
        lessTester.testErrors, null],

    [{math: 'strict', strictUnits: true, javascriptEnabled: false}, 'no-js-errors/',
        lessTester.testErrors, null],
    [{math: 'strict', dumpLineNumbers: 'comments'}, 'debug/', null,
        function(name) { return name + '-comments'; }],
    [{math: 'strict', dumpLineNumbers: 'mediaquery'}, 'debug/', null,
        function(name) { return name + '-mediaquery'; }],
    [{math: 'strict', dumpLineNumbers: 'all'}, 'debug/', null,
        function(name) { return name + '-all'; }],
    // TODO: Change this to rewriteUrls: false once the relativeUrls option is removed
    [{math: 'strict', relativeUrls: false, rootpath: 'folder (1)/'}, 'static-urls/'],
    [{math: 'strict', compress: true}, 'compression/'],
    [{math: 0, strictUnits: true}, 'strict-units/'],
    [{}, 'legacy/'],
    [{math: 'strict', strictUnits: true, sourceMap: true, globalVars: true }, 'sourcemaps/',
        lessTester.testSourcemap, null, null,
        function(filename, type, baseFolder) {
            if (type === 'vars') {
                return path.join(baseFolder, filename) + '.json';
            }
            return path.join('test/sourcemaps', filename) + '.json';
        }],
    [{math: 'strict', strictUnits: true, sourceMap: {sourceMapFileInline: true}},
        'sourcemaps-empty/', lessTester.testEmptySourcemap],
    [{globalVars: true, banner: '/**\n  * Test\n  */\n'}, 'globalVars/',
        null, null, null, function(name, type, baseFolder) { return path.join(baseFolder, name) + '.json'; }],
    [{modifyVars: true}, 'modifyVars/',
        null, null, null, function(name, type, baseFolder) { return path.join(baseFolder, name) + '.json'; }],
    [{urlArgs: '424242'}, 'url-args/'],
    [{rewriteUrls: 'all'}, 'rewrite-urls-all/'],
    [{rewriteUrls: 'local'}, 'rewrite-urls-local/'],
    [{rootpath: 'http://example.com/assets/css/', rewriteUrls: 'all'}, 'rootpath-rewrite-urls-all/'],
    [{rootpath: 'http://example.com/assets/css/', rewriteUrls: 'local'}, 'rootpath-rewrite-urls-local/'],
    [{paths: ['test/data/', 'test/less/import/']}, 'include-path/'],
    [{paths: 'test/data/'}, 'include-path-string/'],
    [{plugin: 'test/plugins/postprocess/'}, 'postProcessorPlugin/'],
    [{plugin: 'test/plugins/preprocess/'}, 'preProcessorPlugin/'],
    [{plugin: 'test/plugins/visitor/'}, 'visitorPlugin/'],
    [{plugin: 'test/plugins/filemanager/'}, 'filemanagerPlugin/'],
    [{}, 'no-strict-math/'],
    [{}, '3rd-party/']
];
testMap.forEach(function(args) {
    lessTester.runTestSet.apply(lessTester, args)
});
lessTester.testSyncronous({syncImport: true}, 'import');
lessTester.testSyncronous({syncImport: true}, 'math/strict-legacy/css');
lessTester.testNoOptions();
lessTester.testJSImport();
lessTester.finished();

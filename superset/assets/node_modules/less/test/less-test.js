/* jshint latedef: nofunc */

module.exports = function() {
    var path = require('path'),
        fs = require('fs'),
        copyBom = require('./copy-bom')(),
        doBomTest = false,
        clone = require('clone');

    var less = require('../lib/less-node');
    var stylize = require('../lib/less-node/lessc-helper').stylize;

    var globals = Object.keys(global);

    var oneTestOnly = process.argv[2],
        isFinished = false;

    var isVerbose = process.env.npm_config_loglevel !== 'concise';

    var normalFolder = 'test/less';
    var bomFolder = 'test/less-bom';

    // Define String.prototype.endsWith if it doesn't exist (in older versions of node)
    // This is required by the testSourceMap function below
    if (typeof String.prototype.endsWith !== 'function') {
        String.prototype.endsWith = function (str) {
            return this.slice(-str.length) === str;
        }
    }

    less.logger.addListener({
        info: function(msg) {
            if (isVerbose) {
                process.stdout.write(msg + '\n');
            }
        },
        warn: function(msg) {
            process.stdout.write(msg + '\n');
        },
        error: function(msg) {
            process.stdout.write(msg + '\n');
        }
    });

    var queueList = [],
        queueRunning = false;
    function queue(func) {
        if (queueRunning) {
            // console.log("adding to queue");
            queueList.push(func);
        } else {
            // console.log("first in queue - starting");
            queueRunning = true;
            func();
        }
    }
    function release() {
        if (queueList.length) {
            // console.log("running next in queue");
            var func = queueList.shift();
            setTimeout(func, 0);
        } else {
            // console.log("stopping queue");
            queueRunning = false;
        }
    }

    var totalTests = 0,
        failedTests = 0,
        passedTests = 0,
        finishTimer = setInterval(endTest, 500);

    less.functions.functionRegistry.addMultiple({
        add: function (a, b) {
            return new(less.tree.Dimension)(a.value + b.value);
        },
        increment: function (a) {
            return new(less.tree.Dimension)(a.value + 1);
        },
        _color: function (str) {
            if (str.value === 'evil red') { return new(less.tree.Color)('600'); }
        }
    });

    function testSourcemap(name, err, compiledLess, doReplacements, sourcemap, baseFolder) {
        if (err) {
            fail('ERROR: ' + (err && err.message));
            return;
        }
        // Check the sourceMappingURL at the bottom of the file
        var expectedSourceMapURL = name + '.css.map',
            sourceMappingPrefix = '/*# sourceMappingURL=',
            sourceMappingSuffix = ' */',
            expectedCSSAppendage = sourceMappingPrefix + expectedSourceMapURL + sourceMappingSuffix;
        if (!compiledLess.endsWith(expectedCSSAppendage)) {
            // To display a better error message, we need to figure out what the actual sourceMappingURL value was, if it was even present
            var indexOfSourceMappingPrefix = compiledLess.indexOf(sourceMappingPrefix);
            if (indexOfSourceMappingPrefix === -1) {
                fail('ERROR: sourceMappingURL was not found in ' + baseFolder + '/' + name + '.css.');
                return;
            }

            var startOfSourceMappingValue = indexOfSourceMappingPrefix + sourceMappingPrefix.length,
                indexOfNextSpace = compiledLess.indexOf(' ', startOfSourceMappingValue),
                actualSourceMapURL = compiledLess.substring(startOfSourceMappingValue, indexOfNextSpace === -1 ? compiledLess.length : indexOfNextSpace);
            fail('ERROR: sourceMappingURL should be "' + expectedSourceMapURL + '" but is "' + actualSourceMapURL + '".');
        }

        fs.readFile(path.join('test/', name) + '.json', 'utf8', function (e, expectedSourcemap) {
            process.stdout.write('- ' + path.join(baseFolder, name) + ': ');
            if (sourcemap === expectedSourcemap) {
                ok('OK');
            } else if (err) {
                fail('ERROR: ' + (err && err.message));
                if (isVerbose) {
                    process.stdout.write('\n');
                    process.stdout.write(err.stack + '\n');
                }
            } else {
                difference('FAIL', expectedSourcemap, sourcemap);
            }
        });
    }

    function testEmptySourcemap(name, err, compiledLess, doReplacements, sourcemap, baseFolder) {
        process.stdout.write('- ' + path.join(baseFolder, name) + ': ');
        if (err) {
            fail('ERROR: ' + (err && err.message));
        } else {
            var expectedSourcemap = undefined;
            if ( compiledLess !== '' ) {
                difference('\nCompiledLess must be empty', '', compiledLess);

            } else if (sourcemap !== expectedSourcemap) {
                fail('Sourcemap must be undefined');
            } else {
                ok('OK');
            }
        }
    }

    function testErrors(name, err, compiledLess, doReplacements, sourcemap, baseFolder) {
        fs.readFile(path.join(baseFolder, name) + '.txt', 'utf8', function (e, expectedErr) {
            process.stdout.write('- ' + path.join(baseFolder, name) + ': ');
            expectedErr = doReplacements(expectedErr, baseFolder, err && err.filename);
            if (!err) {
                if (compiledLess) {
                    fail('No Error', 'red');
                } else {
                    fail('No Error, No Output');
                }
            } else {
                var errMessage = err.toString();
                if (errMessage === expectedErr) {
                    ok('OK');
                } else {
                    difference('FAIL', expectedErr, errMessage);
                }
            }
        });
    }

    // https://github.com/less/less.js/issues/3112
    function testJSImport() {
        process.stdout.write('- Testing root function registry');
        less.functions.functionRegistry.add('ext', function() { 
            return new less.tree.Anonymous('file');
        });
        var expected = '@charset "utf-8";\n';
        toCSS({}, require('path').join(process.cwd(), 'test/less/root-registry/root.less'), function(error, output) {
            if (error) {
                return fail('ERROR: ' + error);
            }
            if (output.css === expected) {
                return ok('OK');
            }
            difference('FAIL', expected, output.css);
        });
    }

    function globalReplacements(input, directory, filename) {
        var path = require('path');
        var p = filename ? path.join(path.dirname(filename), '/') : path.join(process.cwd(), directory),
            pathimport = path.join(process.cwd(), directory + 'import/'),
            pathesc = p.replace(/[.:/\\]/g, function(a) { return '\\' + (a == '\\' ? '\/' : a); }),
            pathimportesc = pathimport.replace(/[.:/\\]/g, function(a) { return '\\' + (a == '\\' ? '\/' : a); });

        return input.replace(/\{path\}/g, p)
                .replace(/\{node\}/g, '')
                .replace(/\{\/node\}/g, '')
                .replace(/\{pathhref\}/g, '')
                .replace(/\{404status\}/g, '')
                .replace(/\{nodepath\}/g, path.join(process.cwd(), 'node_modules', '/'))
                .replace(/\{pathrel\}/g, path.join(path.relative(process.cwd(), p), '/')) 
                .replace(/\{pathesc\}/g, pathesc)
                .replace(/\{pathimport\}/g, pathimport)
                .replace(/\{pathimportesc\}/g, pathimportesc)
                .replace(/\r\n/g, '\n');
    }

    function checkGlobalLeaks() {
        return Object.keys(global).filter(function(v) {
            return globals.indexOf(v) < 0;
        });
    }

    function testSyncronous(options, filenameNoExtension) {
        if (oneTestOnly && ('Test Sync ' + filenameNoExtension) !== oneTestOnly) {
            return;
        }
        totalTests++;
        queue(function() {
            var isSync = true;
            toCSS(options, path.join(normalFolder, filenameNoExtension + '.less'), function (err, result) {
                process.stdout.write('- Test Sync ' + filenameNoExtension + ': ');

                if (isSync) {
                    ok('OK');
                } else {
                    fail('Not Sync');
                }
                release();
            });
            isSync = false;
        });
    }

    function prepBomTest() {
        copyBom.copyFolderWithBom(normalFolder, bomFolder);
        doBomTest = true;
    }

    function runTestSet(options, foldername, verifyFunction, nameModifier, doReplacements, getFilename) {
        options = options ? clone(options) : {};
        runTestSetInternal(normalFolder, options, foldername, verifyFunction, nameModifier, doReplacements, getFilename);
        if (doBomTest) {
            runTestSetInternal(bomFolder, options, foldername, verifyFunction, nameModifier, doReplacements, getFilename);
        }
    }

    function runTestSetNormalOnly(options, foldername, verifyFunction, nameModifier, doReplacements, getFilename) {
        runTestSetInternal(normalFolder, options, foldername, verifyFunction, nameModifier, doReplacements, getFilename);
    }

    function runTestSetInternal(baseFolder, opts, foldername, verifyFunction, nameModifier, doReplacements, getFilename) {
        foldername = foldername || '';
        
        var originalOptions = opts || {};

        if (!doReplacements) {
            doReplacements = globalReplacements;
        }

        function getBasename(file) {
            return foldername + path.basename(file, '.less');
        }

        fs.readdirSync(path.join(baseFolder, foldername)).forEach(function (file) {
            if (!/\.less$/.test(file)) { return; }

            var options = clone(originalOptions);

            var name = getBasename(file);

            if (oneTestOnly && name !== oneTestOnly) {
                return;
            }

            totalTests++;

            if (options.sourceMap && !options.sourceMap.sourceMapFileInline) {
                options.sourceMap = {
                    sourceMapOutputFilename: name + '.css',
                    sourceMapBasepath: path.join(process.cwd(), baseFolder),
                    sourceMapRootpath: 'testweb/'
                };
                // This options is normally set by the bin/lessc script. Setting it causes the sourceMappingURL comment to be appended to the CSS
                // output. The value is designed to allow the sourceMapBasepath option to be tested, as it should be removed by less before
                // setting the sourceMappingURL value, leaving just the sourceMapOutputFilename and .map extension.
                options.sourceMap.sourceMapFilename = options.sourceMap.sourceMapBasepath + '/' + options.sourceMap.sourceMapOutputFilename + '.map';
            }

            options.getVars = function(file) {
                try {
                    return JSON.parse(fs.readFileSync(getFilename(getBasename(file), 'vars', baseFolder), 'utf8'));
                }
                catch (e) {
                    return {};
                }
            };

            var doubleCallCheck = false;
            queue(function() {
                toCSS(options, path.join(baseFolder, foldername + file), function (err, result) {

                    if (doubleCallCheck) {
                        totalTests++;
                        fail('less is calling back twice');
                        process.stdout.write(doubleCallCheck + '\n');
                        process.stdout.write((new Error()).stack + '\n');
                        return;
                    }
                    doubleCallCheck = (new Error()).stack;

                    if (verifyFunction) {
                        var verificationResult = verifyFunction(name, err, result && result.css, doReplacements, result && result.map, baseFolder);
                        release();
                        return verificationResult;
                    }

                    if (err) {
                        fail('ERROR: ' + (err && err.message));
                        if (isVerbose) {
                            process.stdout.write('\n');
                            if (err.stack) {
                                process.stdout.write(err.stack + '\n');
                            } else {
                                // this sometimes happen - show the whole error object
                                console.log(err);
                            }
                        }
                        release();
                        return;
                    }
                    var css_name = name;
                    if (nameModifier) { css_name = nameModifier(name); }
                    fs.readFile(path.join('test/css', css_name) + '.css', 'utf8', function (e, css) {
                        process.stdout.write('- ' + path.join(baseFolder, css_name) + ': ');

                        css = css && doReplacements(css, path.join(baseFolder, foldername));
                        if (result.css === css) { ok('OK'); }
                        else {
                            difference('FAIL', css, result.css);
                        }
                        release();
                    });
                });
            });
        });
    }

    function diff(left, right) {
        require('diff').diffLines(left, right).forEach(function(item) {
            if (item.added || item.removed) {
                var text = item.value && item.value.replace('\n', String.fromCharCode(182) + '\n').replace('\ufeff', '[[BOM]]');
                process.stdout.write(stylize(text, item.added ? 'green' : 'red'));
            } else {
                process.stdout.write(item.value && item.value.replace('\ufeff', '[[BOM]]'));
            }
        });
        process.stdout.write('\n');
    }

    function fail(msg) {
        process.stdout.write(stylize(msg, 'red') + '\n');
        failedTests++;
        endTest();
    }

    function difference(msg, left, right) {
        process.stdout.write(stylize(msg, 'yellow') + '\n');
        failedTests++;

        diff(left, right);
        endTest();
    }

    function ok(msg) {
        process.stdout.write(stylize(msg, 'green') + '\n');
        passedTests++;
        endTest();
    }

    function finished() {
        isFinished = true;
        endTest();
    }

    function endTest() {
        if (isFinished && ((failedTests + passedTests) >= totalTests)) {
            clearInterval(finishTimer);
            var leaked = checkGlobalLeaks();
            process.stdout.write('\n');
            if (failedTests > 0) {
                process.stdout.write(failedTests + stylize(' Failed', 'red') + ', ' + passedTests + ' passed\n');
            } else {
                process.stdout.write(stylize('All Passed ', 'green') + passedTests + ' run\n');
            }
            if (leaked.length > 0) {
                process.stdout.write('\n');
                process.stdout.write(stylize('Global leak detected: ', 'red') + leaked.join(', ') + '\n');
            }

            if (leaked.length || failedTests) {
                process.on('exit', function() { process.reallyExit(1); });
            }
        }
    }

    function contains(fullArray, obj) {
        for (var i = 0; i < fullArray.length; i++) {
            if (fullArray[i] === obj) {
                return true;
            }
        }
        return false;
    }

    function toCSS(options, path, callback) {
        options = options || {};
        var str = fs.readFileSync(path, 'utf8'), addPath = require('path').dirname(path);
        if (typeof options.paths !== 'string') {
            options.paths = options.paths || [];
            if (!contains(options.paths, addPath)) {
                options.paths.push(addPath);
            }
        }
        options.filename = require('path').resolve(process.cwd(), path);
        options.optimization = options.optimization || 0;

        if (options.globalVars) {
            options.globalVars = options.getVars(path);
        } else if (options.modifyVars) {
            options.modifyVars = options.getVars(path);
        }
        if (options.plugin) {
            var Plugin = require(require('path').resolve(process.cwd(), options.plugin));
            options.plugins = [Plugin];
        }
        less.render(str, options, callback);
    }

    function testNoOptions() {
        if (oneTestOnly && 'Integration' !== oneTestOnly) {
            return;
        }
        totalTests++;
        try {
            process.stdout.write('- Integration - creating parser without options: ');
            less.render('');
        } catch (e) {
            fail(stylize('FAIL\n', 'red'));
            return;
        }
        ok(stylize('OK\n', 'green'));
    }

    return {
        runTestSet: runTestSet,
        runTestSetNormalOnly: runTestSetNormalOnly,
        testSyncronous: testSyncronous,
        testErrors: testErrors,
        testSourcemap: testSourcemap,
        testEmptySourcemap: testEmptySourcemap,
        testNoOptions: testNoOptions,
        prepBomTest: prepBomTest,
        testJSImport: testJSImport,
        finished: finished
    };
};

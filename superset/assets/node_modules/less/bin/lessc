#!/usr/bin/env node

var path = require('path'),
    fs = require('../lib/less-node/fs'),
    os = require('os'),
    utils = require('../lib/less/utils'),
    Constants = require('../lib/less/constants'),
    errno,
    mkdirp;

try {
    errno = require('errno');
} catch (err) {
    errno = null;
}

var less = require('../lib/less-node'),
    pluginManager = new less.PluginManager(less),
    fileManager = new less.FileManager(),
    plugins = [],
    queuePlugins = [],
    args = process.argv.slice(1),
    silent = false,
    verbose = false,
    options = less.options;

options.plugins = plugins;
options.reUsePluginManager = true;

var sourceMapOptions = {};
var continueProcessing = true;

// Calling process.exit does not flush stdout always. Instead of exiting the process, we set the process' exitCode,
// close all handles and wait for the event loop to exit the process.
// @see https://github.com/nodejs/node/issues/6409
// Unfortunately, node 0.10.x does not support setting process.exitCode, so we need to call reallyExit() explicitly.
// @see https://nodejs.org/api/process.html#process_process_exitcode
// Additionally we also need to make sure that uncaughtExceptions are never swallowed.
// @see https://github.com/less/less.js/issues/2881
// This code can safely be removed if node 0.10.x is not supported anymore.
process.on('exit', function() { process.reallyExit(process.exitCode); });
process.on('uncaughtException', function(err) {
    console.error(err);
    process.exitCode = 1;
});
// This code will still be required because otherwise rejected promises would not be reported to the user
process.on('unhandledRejection', function(err) {
    console.error(err);
    process.exitCode = 1;
});

var checkArgFunc = function(arg, option) {
    if (!option) {
        console.error(arg + ' option requires a parameter');
        continueProcessing = false;
        process.exitCode = 1;
        return false;
    }
    return true;
};

var checkBooleanArg = function(arg) {
    var onOff = /^((on|t|true|y|yes)|(off|f|false|n|no))$/i.exec(arg);
    if (!onOff) {
        console.error(' unable to parse ' + arg + ' as a boolean. use one of on/t/true/y/yes/off/f/false/n/no');
        continueProcessing = false;
        process.exitCode = 1;
        return false;
    }
    return Boolean(onOff[2]);
};

var parseVariableOption = function(option, variables) {
    var parts = option.split('=', 2);
    variables[parts[0]] = parts[1];
};

var sourceMapFileInline = false;

function printUsage() {
    less.lesscHelper.printUsage();
    pluginManager.Loader.printUsage(plugins);
    continueProcessing = false;
}
function render() {

    if (!continueProcessing) {
        return;
    }

    var input = args[1];
    if (input && input != '-') {
        input = path.resolve(process.cwd(), input);
    }
    var output = args[2];
    var outputbase = args[2];
    if (output) {
        output = path.resolve(process.cwd(), output);
    }

    if (options.sourceMap) {

        sourceMapOptions.sourceMapInputFilename = input;
        if (!sourceMapOptions.sourceMapFullFilename) {
            if (!output && !sourceMapFileInline) {
                console.error('the sourcemap option only has an optional filename if the css filename is given');
                console.error('consider adding --source-map-map-inline which embeds the sourcemap into the css');
                process.exitCode = 1;
                return;
            }
            // its in the same directory, so always just the basename
            if (output) {
                sourceMapOptions.sourceMapOutputFilename = path.basename(output);
                sourceMapOptions.sourceMapFullFilename = output + '.map';
            }
            // its in the same directory, so always just the basename
            if ('sourceMapFullFilename' in sourceMapOptions) {
                sourceMapOptions.sourceMapFilename = path.basename(sourceMapOptions.sourceMapFullFilename);
            }
        } else if (options.sourceMap && !sourceMapFileInline) {
            var mapFilename = path.resolve(process.cwd(), sourceMapOptions.sourceMapFullFilename),
                mapDir = path.dirname(mapFilename),
                outputDir = path.dirname(output);
            // find the path from the map to the output file
            sourceMapOptions.sourceMapOutputFilename = path.join(
                path.relative(mapDir, outputDir), path.basename(output));

            // make the sourcemap filename point to the sourcemap relative to the css file output directory
            sourceMapOptions.sourceMapFilename = path.join(
                path.relative(outputDir, mapDir), path.basename(sourceMapOptions.sourceMapFullFilename));
        }
    }

    if (sourceMapOptions.sourceMapBasepath === undefined) {
        sourceMapOptions.sourceMapBasepath = input ? path.dirname(input) : process.cwd();
    }

    if (sourceMapOptions.sourceMapRootpath === undefined) {
        var pathToMap = path.dirname((sourceMapFileInline ? output : sourceMapOptions.sourceMapFullFilename) || '.'),
            pathToInput = path.dirname(sourceMapOptions.sourceMapInputFilename || '.');
        sourceMapOptions.sourceMapRootpath = path.relative(pathToMap, pathToInput);
    }


    if (!input) {
        console.error('lessc: no input files');
        console.error('');
        printUsage();
        process.exitCode = 1;
        return;
    }

    var ensureDirectory = function (filepath) {
        var dir = path.dirname(filepath),
            cmd,
            existsSync = fs.existsSync || path.existsSync;
        if (!existsSync(dir)) {
            if (mkdirp === undefined) {
                try {mkdirp = require('mkdirp');}
                catch (e) { mkdirp = null; }
            }
            cmd = mkdirp && mkdirp.sync || fs.mkdirSync;
            cmd(dir);
        }
    };

    if (options.depends) {
        if (!outputbase) {
            console.error('option --depends requires an output path to be specified');
            process.exitCode = 1;
            return;
        }
        process.stdout.write(outputbase + ': ');
    }

    if (!sourceMapFileInline) {
        var writeSourceMap = function(output, onDone) {
            output = output || '';
            var filename = sourceMapOptions.sourceMapFullFilename;
            ensureDirectory(filename);
            fs.writeFile(filename, output, 'utf8', function (err) {
                if (err) {
                    var description = 'Error: ';
                    if (errno && errno.errno[err.errno]) {
                        description += errno.errno[err.errno].description;
                    } else {
                        description += err.code + ' ' + err.message;
                    }
                    console.error('lessc: failed to create file ' + filename);
                    console.error(description);
                    process.exitCode = 1;
                } else {
                    less.logger.info('lessc: wrote ' + filename);
                }
                onDone();
            });
        };
    }

    var writeSourceMapIfNeeded = function(output, onDone) {
        if (options.sourceMap && !sourceMapFileInline) {
            writeSourceMap(output, onDone);
        } else {
            onDone();
        }
    };

    var writeOutput = function(output, result, onSuccess) {
        if (options.depends) {
            onSuccess();
        } else if (output) {
            ensureDirectory(output);
            fs.writeFile(output, result.css, {encoding: 'utf8'}, function (err) {
                if (err) {
                    var description = 'Error: ';
                    if (errno && errno.errno[err.errno]) {
                        description += errno.errno[err.errno].description;
                    } else {
                        description += err.code + ' ' + err.message;
                    }
                    console.error('lessc: failed to create file ' + output);
                    console.error(description);
                    process.exitCode = 1;
                } else {
                    less.logger.info('lessc: wrote ' + output);
                    onSuccess();
                }
            });
        } else if (!options.depends) {
            process.stdout.write(result.css);
            onSuccess();
        }
    };

    var logDependencies = function(options, result) {
        if (options.depends) {
            var depends = '';
            for (var i = 0; i < result.imports.length; i++) {
                depends += result.imports[i] + ' ';
            }
            console.log(depends);
        }
    };

    var parseLessFile = function (e, data) {
        if (e) {
            console.error('lessc: ' + e.message);
            process.exitCode = 1;
            return;
        }

        data = data.replace(/^\uFEFF/, '');

        options.paths = [path.dirname(input)].concat(options.paths);
        options.filename = input;

        if (options.lint) {
            options.sourceMap = false;
        }
        sourceMapOptions.sourceMapFileInline = sourceMapFileInline;

        if (options.sourceMap) {
            options.sourceMap = sourceMapOptions;
        }

        less.logger.addListener({
            info: function(msg) {
                if (verbose) {
                    console.log(msg);
                }
            },
            warn: function(msg) {
                // do not show warning if the silent option is used
                if (!silent) {
                    console.warn(msg);
                }
            },
            error: function(msg) {
                console.error(msg);
            }
        });

        less.render(data, options)
            .then(function(result) {
                if (!options.lint) {
                    writeOutput(output, result, function() {
                        writeSourceMapIfNeeded(result.map, function() {
                            logDependencies(options, result);
                        });
                    });
                }
            },
            function(err) {
                if (!options.silent) {
                    console.error(err.toString({
                        stylize: options.color && less.lesscHelper.stylize
                    }));
                }
                process.exitCode = 1;
            });
    };

    if (input != '-') {
        fs.readFile(input, 'utf8', parseLessFile);
    } else {
        process.stdin.resume();
        process.stdin.setEncoding('utf8');

        var buffer = '';
        process.stdin.on('data', function(data) {
            buffer += data;
        });

        process.stdin.on('end', function() {
            parseLessFile(false, buffer);
        });
    }
}

function processPluginQueue() {
    var x = 0;

    function pluginError(name) {
        console.error('Unable to load plugin ' + name +
            ' please make sure that it is installed under or at the same level as less');
        process.exitCode = 1;
    }
    function pluginFinished(plugin) {
        x++;
        plugins.push(plugin);
        if (x === queuePlugins.length) {
            render();
        }
    }
    queuePlugins.forEach(function(queue) {
        var context = utils.clone(options);
        pluginManager.Loader.loadPlugin(queue.name, process.cwd(), context, less.environment, fileManager)
            .then(function(data) {
                pluginFinished({
                    fileContent: data.contents,
                    filename: data.filename,
                    options: queue.options
                });
            })
            .catch(function() {
                pluginError(queue.name);
            });
    });
}

// self executing function so we can return
(function() {
    args = args.filter(function (arg) {
        var match;

        match = arg.match(/^-I(.+)$/);
        if (match) {
            options.paths.push(match[1]);
            return false;
        }

        match = arg.match(/^--?([a-z][0-9a-z-]*)(?:=(.*))?$/i);
        if (match) {
            arg = match[1];
        } else {
            return arg;
        }

        switch (arg) {
            case 'v':
            case 'version':
                console.log('lessc ' + less.version.join('.') + ' (Less Compiler) [JavaScript]');
                continueProcessing = false;
                break;
            case 'verbose':
                verbose = true;
                break;
            case 's':
            case 'silent':
                silent = true;
                break;
            case 'l':
            case 'lint':
                options.lint = true;
                break;
            case 'strict-imports':
                options.strictImports = true;
                break;
            case 'h':
            case 'help':
                printUsage();
                break;
            case 'x':
            case 'compress':
                options.compress = true;
                break;
            case 'insecure':
                options.insecure = true;
                break;
            case 'M':
            case 'depends':
                options.depends = true;
                break;
            case 'max-line-len':
                if (checkArgFunc(arg, match[2])) {
                    options.maxLineLen = parseInt(match[2], 10);
                    if (options.maxLineLen <= 0) {
                        options.maxLineLen = -1;
                    }
                }
                break;
            case 'no-color':
                options.color = false;
                break;
            case 'ie-compat':
                options.ieCompat = true;
                break;
            case 'js':
                options.javascriptEnabled = true;
                break;
            case 'no-js':
                console.error('The "--no-js" argument is deprecated, as inline JavaScript ' +
                    'is disabled by default. Use "--js" to enable inline JavaScript (not recommended).');
                break;
            case 'include-path':
                if (checkArgFunc(arg, match[2])) {
                    // ; supported on windows.
                    // : supported on windows and linux, excluding a drive letter like C:\ so C:\file:D:\file parses to 2
                    options.paths = match[2]
                        .split(os.type().match(/Windows/) ? /:(?!\\)|;/ : ':')
                        .map(function(p) {
                            if (p) {
                                return path.resolve(process.cwd(), p);
                            }
                        });
                }
                break;
            case 'line-numbers':
                if (checkArgFunc(arg, match[2])) {
                    options.dumpLineNumbers = match[2];
                }
                break;
            case 'source-map':
                options.sourceMap = true;
                if (match[2]) {
                    sourceMapOptions.sourceMapFullFilename = match[2];
                }
                break;
            case 'source-map-rootpath':
                if (checkArgFunc(arg, match[2])) {
                    sourceMapOptions.sourceMapRootpath = match[2];
                }
                break;
            case 'source-map-basepath':
                if (checkArgFunc(arg, match[2])) {
                    sourceMapOptions.sourceMapBasepath = match[2];
                }
                break;
            case 'source-map-inline':
            case 'source-map-map-inline':
                sourceMapFileInline = true;
                options.sourceMap = true;
                break;
            case 'source-map-include-source':
            case 'source-map-less-inline':
                sourceMapOptions.outputSourceFiles = true;
                break;
            case 'source-map-url':
                if (checkArgFunc(arg, match[2])) {
                    sourceMapOptions.sourceMapURL = match[2];
                }
                break;
            case 'rp':
            case 'rootpath':
                if (checkArgFunc(arg, match[2])) {
                    options.rootpath = match[2].replace(/\\/g, '/');
                }
                break;
            case 'relative-urls':
                console.warn('The --relative-urls option has been deprecated. Use --rewrite-urls=all.');
                options.rewriteUrls = Constants.RewriteUrls.ALL;
                break;
            case 'ru':
            case 'rewrite-urls':
                var m = match[2];
                if (m) {
                    if (m === 'local') {
                        options.rewriteUrls = Constants.RewriteUrls.LOCAL;
                    } else if (m === 'off') {
                        options.rewriteUrls = Constants.RewriteUrls.OFF;
                    } else if (m === 'all') {
                        options.rewriteUrls = Constants.RewriteUrls.ALL;
                    } else {
                        console.error('Unknown rewrite-urls argument ' + m);
                        continueProcessing = false;
                        process.exitCode = 1;
                    }
                } else {
                    options.rewriteUrls = Constants.RewriteUrls.ALL;
                }
                break;
            case 'sm':
            case 'strict-math':
                console.warn('The --strict-math option has been deprecated. Use --math=strict.');
                if (checkArgFunc(arg, match[2])) {
                    if (checkBooleanArg(match[2])) {
                        options.math = Constants.Math.STRICT_LEGACY;
                    }
                }
                break;
            case 'm':
            case 'math':
                if (checkArgFunc(arg, match[2])) {
                    options.math = match[2];
                }
                break;
            case 'su':
            case 'strict-units':
                if (checkArgFunc(arg, match[2])) {
                    options.strictUnits = checkBooleanArg(match[2]);
                }
                break;
            case 'global-var':
                if (checkArgFunc(arg, match[2])) {
                    if (!options.globalVars) {
                        options.globalVars = {};
                    }
                    parseVariableOption(match[2], options.globalVars);
                }
                break;
            case 'modify-var':
                if (checkArgFunc(arg, match[2])) {
                    if (!options.modifyVars) {
                        options.modifyVars = {};
                    }

                    parseVariableOption(match[2], options.modifyVars);
                }
                break;
            case 'url-args':
                if (checkArgFunc(arg, match[2])) {
                    options.urlArgs = match[2];
                }
                break;
            case 'plugin':
                var splitupArg = match[2].match(/^([^=]+)(=(.*))?/),
                    name = splitupArg[1],
                    pluginOptions = splitupArg[3];
                queuePlugins.push({ name: name, options: pluginOptions });
                break;
            default:
                queuePlugins.push({ name: arg, options: match[2], default: true });
                break;
        }
    });

    if (queuePlugins.length > 0) {
        processPluginQueue();
    }
    else {
        render();
    }

})();

var path = require('path'),
    fs = require('./fs'),
    PromiseConstructor = typeof Promise === 'undefined' ? require('promise') : Promise,
    AbstractFileManager = require('../less/environment/abstract-file-manager.js');

var FileManager = function() {
    this.contents = {};
};

FileManager.prototype = new AbstractFileManager();

FileManager.prototype.supports = function(filename, currentDirectory, options, environment) {
    return true;
};
FileManager.prototype.supportsSync = function(filename, currentDirectory, options, environment) {
    return true;
};

FileManager.prototype.loadFile = function(filename, currentDirectory, options, environment, callback) {

    var fullFilename,
        isAbsoluteFilename = this.isPathAbsolute(filename),
        filenamesTried = [],
        self = this,
        prefix = filename.slice(0, 1),
        explicit = prefix === '.' || prefix === '/',
        result = null,
        isNodeModule = false,
        npmPrefix = 'npm://';

    options = options || {};

    var paths = isAbsoluteFilename ? [''] : [currentDirectory];

    if (options.paths) { paths.push.apply(paths, options.paths); }

    if (!isAbsoluteFilename && paths.indexOf('.') === -1) { paths.push('.'); }

    var prefixes = options.prefixes || [''];
    var fileParts = this.extractUrlParts(filename);

    if (options.syncImport) {
        getFileData(returnData, returnData);
        if (callback) {
            callback(result.error, result);
        }
        else {
            return result;
        }
    }
    else {
        // promise is guaranteed to be asyncronous
        // which helps as it allows the file handle
        // to be closed before it continues with the next file
        return new PromiseConstructor(getFileData);
    }

    function returnData(data) {
        if (!data.filename) {
            result = { error: data };
        }
        else {
            result = data;
        }
    }

    function getFileData(fulfill, reject) {
        (function tryPathIndex(i) {
            if (i < paths.length) {
                (function tryPrefix(j) {
                    if (j < prefixes.length) {
                        isNodeModule = false;
                        fullFilename = fileParts.rawPath + prefixes[j] + fileParts.filename;

                        if (paths[i]) {
                            fullFilename = path.join(paths[i], fullFilename);
                        }

                        if (!explicit && paths[i] === '.') {
                            try {
                                fullFilename = require.resolve(fullFilename);
                                isNodeModule = true;
                            }
                            catch (e) {
                                filenamesTried.push(npmPrefix + fullFilename);
                                tryWithExtension();
                            }
                        }
                        else {
                            tryWithExtension();
                        }

                        function tryWithExtension() {
                            var extFilename = options.ext ? self.tryAppendExtension(fullFilename, options.ext) : fullFilename;

                            if (extFilename !== fullFilename && !explicit && paths[i] === '.') {
                                try {
                                    fullFilename = require.resolve(extFilename);
                                    isNodeModule = true;
                                }
                                catch (e) {
                                    filenamesTried.push(npmPrefix + extFilename);
                                    fullFilename = extFilename;
                                }
                            }
                            else {
                                fullFilename = extFilename;
                            }
                        }

                        var modified = false;

                        if (self.contents[fullFilename]) {
                            try {
                                var stat = fs.statSync.apply(this, [fullFilename]);
                                if (stat.mtime.getTime() === self.contents[fullFilename].mtime.getTime()) {
                                    fulfill({ contents: self.contents[fullFilename].data, filename: fullFilename});
                                }
                                else {
                                    modified = true;
                                }
                            }
                            catch (e) {
                                modified = true;
                            }
                        }
                        if (modified || !self.contents[fullFilename]) {
                            var readFileArgs = [fullFilename];
                            if (!options.rawBuffer) {
                                readFileArgs.push('utf-8');
                            }
                            if (options.syncImport) {
                                try {
                                    var data = fs.readFileSync.apply(this, readFileArgs);
                                    var stat = fs.statSync.apply(this, [fullFilename]);
                                    self.contents[fullFilename] = { data: data, mtime: stat.mtime };
                                    fulfill({ contents: data, filename: fullFilename});
                                }
                                catch (e) {
                                    filenamesTried.push(isNodeModule ? npmPrefix + fullFilename : fullFilename);
                                    return tryPrefix(j + 1);
                                }
                            }
                            else {
                                readFileArgs.push(function(e, data) {
                                    if (e) {
                                        filenamesTried.push(isNodeModule ? npmPrefix + fullFilename : fullFilename);
                                        return tryPrefix(j + 1);
                                    }
                                    var stat = fs.statSync.apply(this, [fullFilename]);
                                    self.contents[fullFilename] = { data: data, mtime: stat.mtime };      
                                    fulfill({ contents: data, filename: fullFilename});
                                });
                                fs.readFile.apply(this, readFileArgs);
                            }

                        }

                    }
                    else {
                        tryPathIndex(i + 1);
                    }
                })(0);
            } else {
                reject({ type: 'File', message: '\'' + filename + '\' wasn\'t found. Tried - ' + filenamesTried.join(',') });
            }
        }(0));
    }
};

FileManager.prototype.loadFileSync = function(filename, currentDirectory, options, environment) {
    options.syncImport = true;
    return this.loadFile(filename, currentDirectory, options, environment);
};

module.exports = FileManager;

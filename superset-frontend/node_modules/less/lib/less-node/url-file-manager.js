var isUrlRe = /^(?:https?:)?\/\//i,
    url = require('url'),
    request,
    PromiseConstructor,
    AbstractFileManager = require('../less/environment/abstract-file-manager.js'),
    logger = require('../less/logger');

var UrlFileManager = function() {
};

UrlFileManager.prototype = new AbstractFileManager();

UrlFileManager.prototype.supports = function(filename, currentDirectory, options, environment) {
    return isUrlRe.test( filename ) || isUrlRe.test(currentDirectory);
};

UrlFileManager.prototype.loadFile = function(filename, currentDirectory, options, environment) {
    if (!PromiseConstructor) {
        PromiseConstructor = typeof Promise === 'undefined' ? require('promise') : Promise;
    }
    return new PromiseConstructor(function(fulfill, reject) {
        if (request === undefined) {
            try { request = require('request'); }
            catch (e) { request = null; }
        }
        if (!request) {
            reject({ type: 'File', message: 'optional dependency \'request\' required to import over http(s)\n' });
            return;
        }

        var urlStr = isUrlRe.test( filename ) ? filename : url.resolve(currentDirectory, filename),
            urlObj = url.parse(urlStr);

        if (!urlObj.protocol) {
            urlObj.protocol = 'http';
            urlStr = urlObj.format();
        }

        request.get({uri: urlStr, strictSSL: !options.insecure }, function (error, res, body) {
            if (error) {
                reject({ type: 'File', message: 'resource \'' + urlStr + '\' gave this Error:\n  ' + error + '\n' });
                return;
            }
            if (res && res.statusCode === 404) {
                reject({ type: 'File', message: 'resource \'' + urlStr + '\' was not found\n' });
                return;
            }
            if (!body) {
                logger.warn('Warning: Empty body (HTTP ' + res.statusCode + ') returned by "' + urlStr + '"');
            }
            fulfill({ contents: body, filename: urlStr });
        });
    });
};

module.exports = UrlFileManager;

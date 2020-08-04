var abstractFileManager = function() {
};

abstractFileManager.prototype.getPath = function (filename) {
    var j = filename.lastIndexOf('?');
    if (j > 0) {
        filename = filename.slice(0, j);
    }
    j = filename.lastIndexOf('/');
    if (j < 0) {
        j = filename.lastIndexOf('\\');
    }
    if (j < 0) {
        return '';
    }
    return filename.slice(0, j + 1);
};

abstractFileManager.prototype.tryAppendExtension = function(path, ext) {
    return /(\.[a-z]*$)|([\?;].*)$/.test(path) ? path : path + ext;
};

abstractFileManager.prototype.tryAppendLessExtension = function(path) {
    return this.tryAppendExtension(path, '.less');
};

abstractFileManager.prototype.supportsSync = function() {
    return false;
};

abstractFileManager.prototype.alwaysMakePathsAbsolute = function() {
    return false;
};

abstractFileManager.prototype.isPathAbsolute = function(filename) {
    return (/^(?:[a-z-]+:|\/|\\|#)/i).test(filename);
};
// TODO: pull out / replace?
abstractFileManager.prototype.join = function(basePath, laterPath) {
    if (!basePath) {
        return laterPath;
    }
    return basePath + laterPath;
};

abstractFileManager.prototype.pathDiff = function pathDiff(url, baseUrl) {
    // diff between two paths to create a relative path

    var urlParts = this.extractUrlParts(url),
        baseUrlParts = this.extractUrlParts(baseUrl),
        i, max, urlDirectories, baseUrlDirectories, diff = '';
    if (urlParts.hostPart !== baseUrlParts.hostPart) {
        return '';
    }
    max = Math.max(baseUrlParts.directories.length, urlParts.directories.length);
    for (i = 0; i < max; i++) {
        if (baseUrlParts.directories[i] !== urlParts.directories[i]) { break; }
    }
    baseUrlDirectories = baseUrlParts.directories.slice(i);
    urlDirectories = urlParts.directories.slice(i);
    for (i = 0; i < baseUrlDirectories.length - 1; i++) {
        diff += '../';
    }
    for (i = 0; i < urlDirectories.length - 1; i++) {
        diff += urlDirectories[i] + '/';
    }
    return diff;
};
// helper function, not part of API
abstractFileManager.prototype.extractUrlParts = function extractUrlParts(url, baseUrl) {
    // urlParts[1] = protocol://hostname/ OR /
    // urlParts[2] = / if path relative to host base
    // urlParts[3] = directories
    // urlParts[4] = filename
    // urlParts[5] = parameters

    var urlPartsRegex = /^((?:[a-z-]+:)?\/{2}(?:[^\/\?#]*\/)|([\/\\]))?((?:[^\/\\\?#]*[\/\\])*)([^\/\\\?#]*)([#\?].*)?$/i,
        urlParts = url.match(urlPartsRegex),
        returner = {}, rawDirectories = [], directories = [], i, baseUrlParts;

    if (!urlParts) {
        throw new Error('Could not parse sheet href - \'' + url + '\'');
    }

    // Stylesheets in IE don't always return the full path
    if (baseUrl && (!urlParts[1] || urlParts[2])) {
        baseUrlParts = baseUrl.match(urlPartsRegex);
        if (!baseUrlParts) {
            throw new Error('Could not parse page url - \'' + baseUrl + '\'');
        }
        urlParts[1] = urlParts[1] || baseUrlParts[1] || '';
        if (!urlParts[2]) {
            urlParts[3] = baseUrlParts[3] + urlParts[3];
        }
    }

    if (urlParts[3]) {
        rawDirectories = urlParts[3].replace(/\\/g, '/').split('/');

        // collapse '..' and skip '.'
        for (i = 0; i < rawDirectories.length; i++) {

            if (rawDirectories[i] === '..') {
                directories.pop();
            }
            else if (rawDirectories[i] !== '.') {
                directories.push(rawDirectories[i]);
            }
        
        }
    }

    returner.hostPart = urlParts[1];
    returner.directories = directories;
    returner.rawPath = (urlParts[1] || '') + rawDirectories.join('/');
    returner.path = (urlParts[1] || '') + directories.join('/');
    returner.filename = urlParts[4];
    returner.fileUrl = returner.path + (urlParts[4] || '');
    returner.url = returner.fileUrl + (urlParts[5] || '');
    return returner;
};

module.exports = abstractFileManager;

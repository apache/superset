var environment = require('./environment'),
    FileManager = require('./file-manager'),
    UrlFileManager = require('./url-file-manager'),
    createFromEnvironment = require('../less'),
    less = createFromEnvironment(environment, [new FileManager(), new UrlFileManager()]),
    lesscHelper = require('./lessc-helper'),
    path = require('path');

// allow people to create less with their own environment
less.createFromEnvironment = createFromEnvironment;
less.lesscHelper = lesscHelper;
less.PluginLoader = require('./plugin-loader');
less.fs = require('./fs');
less.FileManager = FileManager;
less.UrlFileManager = UrlFileManager;

// Set up options
less.options = require('../less/default-options')();

// provide image-size functionality
require('./image-size')(less.environment);

module.exports = less;

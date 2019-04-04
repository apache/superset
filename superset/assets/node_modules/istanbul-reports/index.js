/*
 Copyright 2012-2015, Yahoo Inc.
 Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */
var path = require('path');

module.exports = {
    create: function(name, cfg) {
        cfg = cfg || {};
        var Cons;
        try {
            Cons = require(path.join(__dirname, 'lib', name));
        } catch (e) {
            Cons = require(name);
        }

        return new Cons(cfg);
    }
};

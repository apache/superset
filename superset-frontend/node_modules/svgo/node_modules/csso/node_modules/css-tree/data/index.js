var mdnAtrules = require('mdn-data/css/at-rules.json');
var mdnProperties = require('mdn-data/css/properties.json');
var mdnSyntaxes = require('mdn-data/css/syntaxes.json');
var patch = require('./patch.json');

function preprocessAtrules(dict) {
    var result = Object.create(null);

    for (var atruleName in dict) {
        var atrule = dict[atruleName];
        var descriptors = null;

        if (atrule.descriptors) {
            descriptors = Object.create(null);

            for (var descriptor in atrule.descriptors) {
                descriptors[descriptor] = atrule.descriptors[descriptor].syntax;
            }
        }

        result[atruleName.substr(1)] = {
            prelude: atrule.syntax.trim().match(/^@\S+\s+([^;\{]*)/)[1].trim() || null,
            descriptors
        };
    }

    return result;
}

function buildDictionary(dict, patchDict) {
    var result = {};

    // copy all syntaxes for an original dict
    for (var key in dict) {
        result[key] = dict[key].syntax;
    }

    // apply a patch
    for (var key in patchDict) {
        if (key in dict) {
            if (patchDict[key].syntax) {
                result[key] = patchDict[key].syntax;
            } else {
                delete result[key];
            }
        } else {
            if (patchDict[key].syntax) {
                result[key] = patchDict[key].syntax;
            }
        }
    }

    return result;
}

module.exports = {
    types: buildDictionary(mdnSyntaxes, patch.syntaxes),
    atrules: preprocessAtrules(mdnAtrules),
    properties: buildDictionary(mdnProperties, patch.properties)
};

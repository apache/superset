var mdnProperties = require('mdn-data/css/properties.json');
var mdnSyntaxes = require('mdn-data/css/syntaxes.json');
var patch = require('./patch.json');
var data = {
    properties: {},
    types: {}
};

function normalizeSyntax(syntax) {
    return syntax
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&');
}

function patchDict(dict, patchDict) {
    for (var key in patchDict) {
        if (key in dict) {
            if (patchDict[key].syntax) {
                dict[key].syntax = patchDict[key].syntax;
            } else {
                delete dict[key];
            }
        } else {
            if (patchDict[key].syntax) {
                dict[key] = patchDict[key];
            }
        }
    }
}

// apply patch
patchDict(mdnProperties, patch.properties);
patchDict(mdnSyntaxes, patch.syntaxes);

// normalize source mdnProperties syntaxes, since it uses html token
for (var key in mdnProperties) {
    data.properties[key] = normalizeSyntax(mdnProperties[key].syntax);
}

for (var key in mdnSyntaxes) {
    data.types[key] = normalizeSyntax(mdnSyntaxes[key].syntax);
}

module.exports = data;

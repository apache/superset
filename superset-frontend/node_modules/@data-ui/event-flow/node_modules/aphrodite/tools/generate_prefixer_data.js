#!/usr/bin/env node
const generateData = require("inline-style-prefixer/generator");
const mkdirp = require("mkdirp");

// These versions are the versions that were supported by version 2 of
// inline-style-prefixer.
// https://github.com/rofrischmann/inline-style-prefixer/blob/5f456345960512063cd4e3a0f6984fa1ce8951fb/config.js
const browserList = {
    chrome: 30,
    android: 4,
    firefox: 25,
    ios_saf: 6,
    safari: 6,
    ie: 9,
    ie_mob: 9,
    edge: 12,
    opera: 13,
    op_mini: 5,
    and_uc: 9,
    and_chr: 30,
};

mkdirp(`${__dirname}/../lib`);
generateData(browserList, {
    staticPath: `${__dirname}/../lib/staticPrefixData.js`,
    compatibility: true,
});

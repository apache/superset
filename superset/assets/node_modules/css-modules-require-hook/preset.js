'use strict';

const basename = require('path').basename;
const debug = require('debug')('css-modules:preset');
const dirname = require('path').dirname;
const hook = require('./lib/index');
const seekout = require('seekout');

const preset = seekout('cmrh.conf.js', dirname(module.parent.filename));

if (preset) {
  debug(`→ ${basename(preset)}`);
  hook(require(preset));
} else {
  debug(`→ defaults`);
  hook({});
}

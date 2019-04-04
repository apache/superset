#!/usr/bin/env node
"use strict";

var _options = _interopRequireDefault(require("./options"));

var _dir = _interopRequireDefault(require("./dir"));

var _file = _interopRequireDefault(require("./file"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const opts = (0, _options.default)(process.argv);
const fn = opts.cliOptions.outDir ? _dir.default : _file.default;
fn(opts).catch(err => {
  console.error(err);
  process.exit(1);
});
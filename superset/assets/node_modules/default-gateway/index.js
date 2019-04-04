"use strict";

const platform = require("os").platform();

if ([
  "android",
  "darwin",
  "freebsd",
  "linux",
  "openbsd",
  "sunos",
  "win32"
].indexOf(platform) !== -1) {
  const families = require(`./${platform}`);
  module.exports.v4 = () => families.v4();
  module.exports.v6 = () => families.v6();
  module.exports.v4.sync = () => families.v4.sync();
  module.exports.v6.sync = () => families.v6.sync();
} else {
  const noop = () => { throw new Error(`Unsupported Platform: ${platform}`); };
  module.exports.v4 = noop;
  module.exports.v6 = noop;
  module.exports.v4.sync = noop;
  module.exports.v6.sync = noop;
}

// Node < 13.3 doesn't support export maps in package.json.
// Use this proxy file as a fallback.

module.exports = require("./data/corejs2-built-ins.json");

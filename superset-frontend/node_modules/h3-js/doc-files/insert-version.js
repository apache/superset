const fs = require('fs');
const path = require('path');

module.exports.h3Version = function h3Version() {
    return fs.readFileSync(path.join(__dirname, '..', 'H3_VERSION'), 'utf-8').trim();
};

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// tslint:disable-next-line:no-submodule-imports
const node = require('enhanced-resolve/lib/node');
function makeResolver(options) {
    return node.create.sync(options.resolve);
}
exports.makeResolver = makeResolver;

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var useQueryParams_1 = require("./useQueryParams");
exports.QueryParams = function (_a) {
    var config = _a.config, children = _a.children;
    var _b = useQueryParams_1.default(config), query = _b[0], setQuery = _b[1];
    return children({ query: query, setQuery: setQuery });
};
exports.default = exports.QueryParams;

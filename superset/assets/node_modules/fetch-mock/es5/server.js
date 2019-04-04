'use strict';

var _promise = require('babel-runtime/core-js/promise');

var _promise2 = _interopRequireDefault(_promise);

var _assign = require('babel-runtime/core-js/object/assign');

var _assign2 = _interopRequireDefault(_assign);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var fetch = require('node-fetch');
var Request = fetch.Request;
var Response = fetch.Response;
var Headers = fetch.Headers;
var Stream = require('stream');
var FetchMock = require('./lib/index');
var http = require('http');

FetchMock.global = global;
FetchMock.statusTextMap = http.STATUS_CODES;
FetchMock.Stream = Stream;

FetchMock.config = (0, _assign2.default)(FetchMock.config, {
	Promise: _promise2.default,
	Request: Request,
	Response: Response,
	Headers: Headers
});

module.exports = FetchMock.createInstance(true);
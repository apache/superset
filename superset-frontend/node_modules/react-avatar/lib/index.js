'use strict';

function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

Object.defineProperty(exports, "__esModule", {
  value: true
});
var _exportNames = {
  createAvatarComponent: true,
  GravatarSource: true,
  FacebookSource: true,
  GithubSource: true,
  SkypeSource: true,
  ValueSource: true,
  SrcSource: true,
  IconSource: true,
  TwitterSource: true,
  VKontakteSource: true,
  InstagramSource: true,
  GoogleSource: true,
  RedirectSource: true
};
Object.defineProperty(exports, "createAvatarComponent", {
  enumerable: true,
  get: function get() {
    return _avatar.default;
  }
});
Object.defineProperty(exports, "GravatarSource", {
  enumerable: true,
  get: function get() {
    return _Gravatar.default;
  }
});
Object.defineProperty(exports, "FacebookSource", {
  enumerable: true,
  get: function get() {
    return _Facebook.default;
  }
});
Object.defineProperty(exports, "GithubSource", {
  enumerable: true,
  get: function get() {
    return _Github.default;
  }
});
Object.defineProperty(exports, "SkypeSource", {
  enumerable: true,
  get: function get() {
    return _Skype.default;
  }
});
Object.defineProperty(exports, "ValueSource", {
  enumerable: true,
  get: function get() {
    return _Value.default;
  }
});
Object.defineProperty(exports, "SrcSource", {
  enumerable: true,
  get: function get() {
    return _Src.default;
  }
});
Object.defineProperty(exports, "IconSource", {
  enumerable: true,
  get: function get() {
    return _Icon.default;
  }
});
Object.defineProperty(exports, "TwitterSource", {
  enumerable: true,
  get: function get() {
    return _Twitter.default;
  }
});
Object.defineProperty(exports, "VKontakteSource", {
  enumerable: true,
  get: function get() {
    return _VKontakte.default;
  }
});
Object.defineProperty(exports, "InstagramSource", {
  enumerable: true,
  get: function get() {
    return _Instagram.default;
  }
});
Object.defineProperty(exports, "GoogleSource", {
  enumerable: true,
  get: function get() {
    return _Google.default;
  }
});
Object.defineProperty(exports, "RedirectSource", {
  enumerable: true,
  get: function get() {
    return _AvatarRedirect.default;
  }
});
exports.default = void 0;

var _avatar = _interopRequireWildcard(require("./avatar"));

Object.keys(_avatar).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  if (Object.prototype.hasOwnProperty.call(_exportNames, key)) return;
  Object.defineProperty(exports, key, {
    enumerable: true,
    get: function get() {
      return _avatar[key];
    }
  });
});

var _Gravatar = _interopRequireDefault(require("./sources/Gravatar"));

var _Facebook = _interopRequireDefault(require("./sources/Facebook"));

var _Github = _interopRequireDefault(require("./sources/Github"));

var _Skype = _interopRequireDefault(require("./sources/Skype"));

var _Value = _interopRequireDefault(require("./sources/Value"));

var _Src = _interopRequireDefault(require("./sources/Src"));

var _Icon = _interopRequireDefault(require("./sources/Icon"));

var _Twitter = _interopRequireDefault(require("./sources/Twitter"));

var _VKontakte = _interopRequireDefault(require("./sources/VKontakte"));

var _Instagram = _interopRequireDefault(require("./sources/Instagram"));

var _Google = _interopRequireDefault(require("./sources/Google"));

var _AvatarRedirect = _interopRequireDefault(require("./sources/AvatarRedirect"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _getRequireWildcardCache() { if (typeof WeakMap !== "function") return null; var cache = new WeakMap(); _getRequireWildcardCache = function _getRequireWildcardCache() { return cache; }; return cache; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

// Avatar Redirect
var SOURCES = [_Facebook.default, _Google.default, _Github.default, _Twitter.default, _Instagram.default, _VKontakte.default, _Skype.default, _Gravatar.default, _Src.default, _Value.default, _Icon.default];

var _default = (0, _avatar.default)({
  sources: SOURCES
});

exports.default = _default;
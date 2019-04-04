"use strict";
const idlUtils = require("../generated/utils");
const NavigatorIDImpl = require("./NavigatorID-impl").implementation;
const NavigatorLanguageImpl = require("./NavigatorLanguage-impl").implementation;
const NavigatorOnLineImpl = require("./NavigatorOnLine-impl").implementation;
const NavigatorCookiesImpl = require("./NavigatorCookies-impl").implementation;
const NavigatorPluginsImpl = require("./NavigatorPlugins-impl").implementation;
const NavigatorConcurrentHardwareImpl = require("./NavigatorConcurrentHardware-impl").implementation;

class NavigatorImpl {
  constructor(args, privateData) {
    this.userAgent = privateData.userAgent;
    this.languages = Object.freeze(["en-US", "en"]);
  }
}

idlUtils.mixin(NavigatorImpl.prototype, NavigatorIDImpl.prototype);
idlUtils.mixin(NavigatorImpl.prototype, NavigatorLanguageImpl.prototype);
idlUtils.mixin(NavigatorImpl.prototype, NavigatorOnLineImpl.prototype);
idlUtils.mixin(NavigatorImpl.prototype, NavigatorCookiesImpl.prototype);
idlUtils.mixin(NavigatorImpl.prototype, NavigatorPluginsImpl.prototype);
idlUtils.mixin(NavigatorImpl.prototype, NavigatorConcurrentHardwareImpl.prototype);

exports.implementation = NavigatorImpl;

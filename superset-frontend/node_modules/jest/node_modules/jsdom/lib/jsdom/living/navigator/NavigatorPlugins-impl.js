"use strict";

const PluginArray = require("../generated/PluginArray");
const MimeTypeArray = require("../generated/MimeTypeArray");

exports.implementation = class NavigatorPluginsImpl {
  get plugins() {
    return PluginArray.create();
  }

  get mimeTypes() {
    return MimeTypeArray.create();
  }

  javaEnabled() {
    return false;
  }
};

"use strict";

const { produceXMLSerialization } = require("./serialization");

exports.implementation = class XMLSerializerImpl {
  serializeToString(root) {
    return produceXMLSerialization(root, false);
  }
};

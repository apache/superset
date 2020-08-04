"use strict";

var getPropertyDescriptor = require("./get-property-descriptor");

function isPropertyConfigurable(obj, propName) {
    var propertyDescriptor = getPropertyDescriptor(obj, propName);

    return propertyDescriptor ? propertyDescriptor.configurable : true;
}

module.exports = isPropertyConfigurable;

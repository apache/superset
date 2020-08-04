"use strict";

var samsam = require("@sinonjs/samsam");
var functionName = require("@sinonjs/commons").functionName;
var typeOf = require("@sinonjs/commons").typeOf;

var formatio = {
    excludeConstructors: ["Object", /^.$/],
    quoteStrings: true,
    limitChildrenCount: 0
};

var specialObjects = [];
/* istanbul ignore else */
if (typeof global !== "undefined") {
    specialObjects.push({ object: global, value: "[object global]" });
}
if (typeof document !== "undefined") {
    specialObjects.push({
        object: document,
        value: "[object HTMLDocument]"
    });
}
if (typeof window !== "undefined") {
    specialObjects.push({ object: window, value: "[object Window]" });
}

function constructorName(f, object) {
    var name = functionName(object && object.constructor);
    var excludes = f.excludeConstructors || formatio.excludeConstructors;

    var i, l;
    for (i = 0, l = excludes.length; i < l; ++i) {
        if (typeof excludes[i] === "string" && excludes[i] === name) {
            return "";
        } else if (excludes[i].test && excludes[i].test(name)) {
            return "";
        }
    }

    return name;
}

function isCircular(object, objects) {
    if (typeof object !== "object") {
        return false;
    }
    var i, l;
    for (i = 0, l = objects.length; i < l; ++i) {
        if (objects[i] === object) {
            return true;
        }
    }
    return false;
}

// eslint-disable-next-line complexity
function ascii(f, object, processed, indent) {
    if (typeof object === "string") {
        if (object.length === 0) {
            return "(empty string)";
        }
        var qs = f.quoteStrings;
        var quote = typeof qs !== "boolean" || qs;
        // eslint-disable-next-line quotes
        return processed || quote ? '"' + object + '"' : object;
    }

    if (typeof object === "symbol") {
        return object.toString();
    }

    if (typeof object === "function" && !(object instanceof RegExp)) {
        return ascii.func(object);
    }

    // eslint supports bigint as of version 6.0.0
    // https://github.com/eslint/eslint/commit/e4ab0531c4e44c23494c6a802aa2329d15ac90e5
    // eslint-disable-next-line
    if (typeOf(object) === "bigint") {
        return object.toString();
    }

    var internalProcessed = processed || [];

    if (isCircular(object, internalProcessed)) {
        return "[Circular]";
    }

    if (typeOf(object) === "array") {
        return ascii.array.call(f, object, internalProcessed);
    }

    if (!object) {
        return String(1 / object === -Infinity ? "-0" : object);
    }
    if (samsam.isElement(object)) {
        return ascii.element(object);
    }

    if (
        typeof object.toString === "function" &&
        object.toString !== Object.prototype.toString
    ) {
        return object.toString();
    }

    var i, l;
    for (i = 0, l = specialObjects.length; i < l; i++) {
        if (object === specialObjects[i].object) {
            return specialObjects[i].value;
        }
    }

    if (samsam.isSet(object)) {
        return ascii.set.call(f, object, internalProcessed);
    }

    if (object instanceof Map) {
        return ascii.map.call(f, object, internalProcessed);
    }

    return ascii.object.call(f, object, internalProcessed, indent);
}

ascii.func = function(func) {
    var funcName = functionName(func) || "";
    return "function " + funcName + "() {}";
};

function delimit(str, delimiters) {
    var delims = delimiters || ["[", "]"];
    return delims[0] + str + delims[1];
}

ascii.array = function(array, processed, delimiters) {
    processed.push(array);
    var pieces = [];
    var i, l;
    l =
        this.limitChildrenCount > 0
            ? Math.min(this.limitChildrenCount, array.length)
            : array.length;

    for (i = 0; i < l; ++i) {
        pieces.push(ascii(this, array[i], processed));
    }

    if (l < array.length) {
        pieces.push("[... " + (array.length - l) + " more elements]");
    }

    return delimit(pieces.join(", "), delimiters);
};

ascii.set = function(set, processed) {
    return ascii.array.call(this, Array.from(set), processed, ["Set {", "}"]);
};

ascii.map = function(map, processed) {
    return ascii.array.call(this, Array.from(map), processed, ["Map [", "]"]);
};

function getSymbols(object) {
    if (samsam.isArguments(object)) {
        return [];
    }

    /* istanbul ignore else */
    if (typeof Object.getOwnPropertySymbols === "function") {
        return Object.getOwnPropertySymbols(object);
    }

    /* istanbul ignore next: This is only for IE, since getOwnPropertySymbols
     * does not exist on Object there
     */
    return [];
}

ascii.object = function(object, processed, indent) {
    processed.push(object);
    var internalIndent = indent || 0;
    var pieces = [];
    var properties = Object.keys(object)
        .sort()
        .concat(getSymbols(object));
    var length = 3;
    var prop, str, obj, i, k, l;
    l =
        this.limitChildrenCount > 0
            ? Math.min(this.limitChildrenCount, properties.length)
            : properties.length;

    for (i = 0; i < l; ++i) {
        prop = properties[i];
        obj = object[prop];

        if (isCircular(obj, processed)) {
            str = "[Circular]";
        } else {
            str = ascii(this, obj, processed, internalIndent + 2);
        }

        str =
            (typeof prop === "string" && /\s/.test(prop)
                ? // eslint-disable-next-line quotes
                  '"' + prop + '"'
                : prop.toString()) +
            ": " +
            str;
        length += str.length;
        pieces.push(str);
    }

    var cons = constructorName(this, object);
    var prefix = cons ? "[" + cons + "] " : "";
    var is = "";
    for (i = 0, k = internalIndent; i < k; ++i) {
        is += " ";
    }

    if (l < properties.length) {
        pieces.push("[... " + (properties.length - l) + " more elements]");
    }

    if (length + internalIndent > 80) {
        return (
            prefix + "{\n  " + is + pieces.join(",\n  " + is) + "\n" + is + "}"
        );
    }
    return prefix + "{ " + pieces.join(", ") + " }";
};

ascii.element = function(element) {
    var tagName = element.tagName.toLowerCase();
    var attrs = element.attributes;
    var pairs = [];
    var attr, attrName, i, l, val;

    for (i = 0, l = attrs.length; i < l; ++i) {
        attr = attrs.item(i);
        attrName = attr.nodeName.toLowerCase().replace("html:", "");
        val = attr.nodeValue;
        if (attrName !== "contenteditable" || val !== "inherit") {
            if (val) {
                // eslint-disable-next-line quotes
                pairs.push(attrName + '="' + val + '"');
            }
        }
    }

    var formatted = "<" + tagName + (pairs.length > 0 ? " " : "");
    // SVG elements have undefined innerHTML
    var content = element.innerHTML || "";

    if (content.length > 20) {
        content = content.substr(0, 20) + "[...]";
    }

    var res =
        formatted + pairs.join(" ") + ">" + content + "</" + tagName + ">";

    return res.replace(/ contentEditable="inherit"/, "");
};

function Formatio(options) {
    // eslint-disable-next-line guard-for-in
    for (var opt in options) {
        this[opt] = options[opt];
    }
}

Formatio.prototype = {
    functionName: functionName,

    configure: function(options) {
        return new Formatio(options);
    },

    constructorName: function(object) {
        return constructorName(this, object);
    },

    ascii: function(object, processed, indent) {
        return ascii(this, object, processed, indent);
    }
};

module.exports = Formatio.prototype;

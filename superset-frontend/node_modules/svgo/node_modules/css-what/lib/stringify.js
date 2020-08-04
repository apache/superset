"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var actionTypes = {
    equals: "",
    element: "~",
    start: "^",
    end: "$",
    any: "*",
    not: "!",
    hyphen: "|"
};
var simpleSelectors = {
    child: " > ",
    parent: " < ",
    sibling: " ~ ",
    adjacent: " + ",
    descendant: " ",
    universal: "*"
};
function stringify(token) {
    return token.map(stringifySubselector).join(", ");
}
exports.default = stringify;
function stringifySubselector(token) {
    return token.map(stringifyToken).join("");
}
function stringifyToken(token) {
    if (token.type in simpleSelectors)
        return simpleSelectors[token.type];
    if (token.type === "tag")
        return escapeName(token.name);
    if (token.type === "pseudo-element")
        return "::" + escapeName(token.name);
    if (token.type === "attribute") {
        if (token.action === "exists") {
            return "[" + escapeName(token.name) + "]";
        }
        if (token.name === "id" &&
            token.action === "equals" &&
            !token.ignoreCase) {
            return "#" + escapeName(token.value);
        }
        if (token.name === "class" &&
            token.action === "element" &&
            !token.ignoreCase) {
            return "." + escapeName(token.value);
        }
        var atributeName = escapeName(token.name);
        var action = actionTypes[token.action];
        var value = escapeName(token.value);
        var ignoreCase = token.ignoreCase ? "i" : "";
        return "[" + atributeName + action + "='" + value + "'" + ignoreCase + "]";
    }
    if (token.type === "pseudo") {
        if (token.data === null)
            return ":" + escapeName(token.name);
        if (typeof token.data === "string") {
            return ":" + escapeName(token.name) + "(" + token.data + ")";
        }
        return ":" + escapeName(token.name) + "(" + stringify(token.data) + ")";
    }
    throw new Error("Unknown type");
}
function escapeName(str) {
    //TODO
    return str;
}

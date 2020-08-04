"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function getChildren(elem) {
    // @ts-ignore
    return elem.children || null;
}
exports.getChildren = getChildren;
function getParent(elem) {
    return elem.parent || null;
}
exports.getParent = getParent;
function getSiblings(elem) {
    var parent = getParent(elem);
    return parent ? getChildren(parent) : [elem];
}
exports.getSiblings = getSiblings;
function getAttributeValue(elem, name) {
    return elem.attribs && elem.attribs[name];
}
exports.getAttributeValue = getAttributeValue;
function hasAttrib(elem, name) {
    return !!getAttributeValue(elem, name);
}
exports.hasAttrib = hasAttrib;
/***
 * Returns the name property of an element
 *
 * @argument elem The element to get the name for
 */
function getName(elem) {
    return elem.name;
}
exports.getName = getName;

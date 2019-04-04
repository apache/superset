"use strict";

exports.DOMException = require("../web-idl/DOMException");
exports.NamedNodeMap = require("./attributes").NamedNodeMap;
exports.Attr = require("./generated/Attr").interface;
exports.Node = require("./generated/Node").interface;
exports.Element = require("./generated/Element").interface;
exports.DocumentFragment = require("./generated/DocumentFragment").interface;
exports.Document = exports.HTMLDocument = require("./generated/Document").interface;
exports.XMLDocument = require("./generated/XMLDocument").interface;
exports.CharacterData = require("./generated/CharacterData").interface;
exports.Text = require("./generated/Text").interface;
exports.CDATASection = require("./generated/CDATASection").interface;
exports.ProcessingInstruction = require("./generated/ProcessingInstruction").interface;
exports.Comment = require("./generated/Comment").interface;
exports.DocumentType = require("./generated/DocumentType").interface;
exports.DOMImplementation = require("./generated/DOMImplementation").interface;

exports.Event = require("./generated/Event").interface;
exports.CustomEvent = require("./generated/CustomEvent").interface;
exports.MessageEvent = require("./generated/MessageEvent").interface;
exports.ErrorEvent = require("./generated/ErrorEvent").interface;
exports.HashChangeEvent = require("./generated/HashChangeEvent").interface;
exports.FocusEvent = require("./generated/FocusEvent").interface;
exports.PopStateEvent = require("./generated/PopStateEvent").interface;
exports.UIEvent = require("./generated/UIEvent").interface;
exports.MouseEvent = require("./generated/MouseEvent").interface;
exports.KeyboardEvent = require("./generated/KeyboardEvent").interface;
exports.TouchEvent = require("./generated/TouchEvent").interface;
exports.ProgressEvent = require("./generated/ProgressEvent").interface;
exports.EventTarget = require("./generated/EventTarget").interface;

exports.Location = require("./generated/Location").interface;
exports.History = require("./generated/History").interface;

exports.Blob = require("./generated/Blob").interface;
exports.File = require("./generated/File").interface;
exports.FileList = require("./generated/FileList").interface;

exports.DOMParser = require("./generated/DOMParser").interface;

exports.FormData = require("./generated/FormData").interface;

require("./register-elements")(exports);

// These need to be cleaned up...
require("../level2/style")(exports);
require("../level3/xpath")(exports);

// These are OK but need migration to webidl2js eventually.
require("./html-collection")(exports);
require("./node-filter")(exports);
require("./node-iterator")(exports);
require("./node-list")(exports);
require("./xmlhttprequest-event-target")(exports);
require("./xmlhttprequest-upload")(exports);

exports.DOMTokenList = require("./dom-token-list").DOMTokenList;
exports.URL = require("whatwg-url").URL;

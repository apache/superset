"use strict";

const tokenRegexp = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;
const contentTypeRegexp = /^(.*?)\/(.*?)([\t ]*;.*)?$/;
const parameterValueRegexp = /^(.*?)=(.*)$/;
const quotedStringRegexp = /"(?:[\t \x21\x23-\x5B\x5D-\x7E\x80-\xFF]|(?:\\[\t \x21-\x7E\x80-\xFF]))*"/;
const qescRegExp = /\\([\t \x21-\x7E\x80-\xFF])/g;
const quoteRegExp = /([\\"])/g;

function qstring(val) {
  if (tokenRegexp.test(val)) {
    return val;
  }
  return "\"" + val.replace(quoteRegExp, "\\$1") + "\"";
}

class ContentType {
  constructor(type, subtype, parameterList) {
    this.type = type;
    this.subtype = subtype;
    this.parameterList = parameterList;
  }
  get(key) {
    key = String(key).toLowerCase();

    const param = this.parameterList.reverse().find(v => v.key === key);
    return param ? param.value : undefined;
  }
  set(key, value) {
    key = String(key).toLowerCase();
    value = String(value);

    this.parameterList = this.parameterList.filter(v => v.key !== key);
    this.parameterList.push({
      separator: ";",
      key,
      value
    });
  }
  isXML() {
    return (this.subtype === "xml" && (this.type === "text" || this.type === "application")) ||
           this.subtype.endsWith("+xml");
  }
  isHTML() {
    return this.subtype === "html" && this.type === "text";
  }
  isText() {
    return this.type === "text";
  }
  toString() {
    return this.type + "/" + this.subtype +
      this.parameterList.map(v => v.separator + (v.key ? v.key + "=" + qstring(v.value) : v.value))
      .join("");
  }
}

module.exports = function parseContentType(contentType) {
  if (!contentType) {
    return null;
  }
  const contentTypeMatch = contentTypeRegexp.exec(contentType);
  if (contentTypeMatch) {
    const type = contentTypeMatch[1];
    const subtype = contentTypeMatch[2];
    const parameters = contentTypeMatch[3];
    if (tokenRegexp.test(type) && tokenRegexp.test(subtype)) {
      const parameterPattern = /([\t ]*;[\t ]*)([^\t ;]*)/g;
      const parameterList = [];
      let match;
      while ((match = parameterPattern.exec(parameters))) {
        const separator = match[1];
        const keyValue = parameterValueRegexp.exec(match[2]);
        let key;
        let value;
        if (keyValue && tokenRegexp.test(keyValue[1])) {
          key = keyValue[1];
          if (quotedStringRegexp.test(keyValue[2])) {
            value = keyValue[2]
              .substr(1, keyValue[2].length - 2)
              .replace(qescRegExp, "$1");
          } else {
            value = keyValue[2];
          }
        }
        if (key) {
          parameterList.push({
            separator,
            key: key.toLowerCase(),
            value
          });
        } else {
          parameterList.push({
            separator,
            value: match[2]
          });
        }
      }
      return new ContentType(type.toLowerCase(), subtype.toLowerCase(), parameterList);
    }
    return null;
  }
  return null;
};

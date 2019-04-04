## 1.5.1
 * Fix: Qualified tag name emission in Serializer (GH [#79](https://github.com/inikulin/parse5/issues/79)).

## 1.5.0
 * Add: Location info for the element start and end tags (by @sakagg).

## 1.4.2
 * Fix: htmlparser2 tree adapter `DocumentType.data` property rendering (GH [#45](https://github.com/inikulin/parse5/issues/45)).

## 1.4.1
 * Fix: Location info handling for the implicitly generated `<html>` and `<body>` elements (GH [#44](https://github.com/inikulin/parse5/issues/44)).

## 1.4.0
 * Add: Parser [decodeHtmlEntities](https://github.com/inikulin/parse5#optionsdecodehtmlentities) option.
 * Add: SimpleApiParser [decodeHtmlEntities](https://github.com/inikulin/parse5#optionsdecodehtmlentities-1) option.
 * Add: Parser [locationInfo](https://github.com/inikulin/parse5#optionslocationinfo) option.
 * Add: SimpleApiParser [locationInfo](https://github.com/inikulin/parse5#optionslocationinfo-1) option.

## 1.3.2
 * Fix: `<form>` processing in `<template>` (GH [#40](https://github.com/inikulin/parse5/issues/40)).

## 1.3.1
 * Fix: text node in `<template>` serialization problem with custom tree adapter (GH [#38](https://github.com/inikulin/parse5/issues/38)).

## 1.3.0
 * Add: Serializer `encodeHtmlEntities` option.

## 1.2.0
 * Add: `<template>` support
 * `parseFragment` now uses `<template>` as default `contextElement`. This leads to the more "forgiving" parsing manner.
 * `TreeSerializer` was renamed to `Serializer`. However, serializer is accessible as `parse5.TreeSerializer` for backward compatibility .

## 1.1.6
 * Fix: apply latest changes to the `htmlparser2` tree format (DOM Level1 node emulation).

## 1.1.5
 * Add: [jsdom](https://github.com/tmpvar/jsdom)-specific parser with scripting support. Undocumented for `jsdom` internal use only.

## 1.1.4
 * Add: logo
 * Fix: use fake `document` element for fragment parsing (required by [jsdom](https://github.com/tmpvar/jsdom)).

## 1.1.3
 * Development files (e.g. `.travis.yml`, `.editorconfig`) are removed from NPM package.

## 1.1.2
 * Fix: crash on Linux due to upper-case leading character in module name used in `require()`.

## 1.1.1
 * Add: [SimpleApiParser](https://github.com/inikulin/parse5/#class-simpleapiparser).
 * Fix: new line serialization in `<pre>`.
 * Fix: `SYSTEM`-only `DOCTYPE` serialization.
 * Fix: quotes serialization in `DOCTYPE` IDs.

## 1.0.0
 * First stable release, switch to semantic versioning.

## 0.8.3
 * Fix: siblings calculation bug in `appendChild` in `htmlparser2` tree adapter.

## 0.8.1
 * Add: [TreeSerializer](https://github.com/inikulin/parse5/#class-serializer).
 * Add: [htmlparser2 tree adapter](https://github.com/inikulin/parse5/#-treeadaptershtmlparser2).

## 0.6.1
 * Fix: incorrect `<menuitem>` handling in `<body>`.

## 0.6.0
 * Initial release.

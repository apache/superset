/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
"use strict";

var SourceNode = require("source-map").SourceNode;
var SourceMapConsumer = require("source-map").SourceMapConsumer;
var SourceMapGenerator = require("source-map").SourceMapGenerator;
var SourceListMap = require("source-list-map").SourceListMap;
var fromStringWithSourceMap = require("source-list-map").fromStringWithSourceMap;
var Source = require("./Source");

class SourceMapSource extends Source {
	constructor(value, name, sourceMap, originalSource, innerSourceMap) {
		super();
		this._value = value;
		this._name = name;
		this._sourceMap = sourceMap;
		this._originalSource = originalSource;
		this._innerSourceMap = innerSourceMap;
	}

	source() {
		return this._value;
	}

	node(options) {
		var innerSourceMap = this._innerSourceMap;
		var sourceMap = this._sourceMap;
		if(innerSourceMap) {
			sourceMap = SourceMapGenerator.fromSourceMap(new SourceMapConsumer(sourceMap));
			if(this._originalSource)
				sourceMap.setSourceContent(this._name, this._originalSource);
			innerSourceMap = new SourceMapConsumer(innerSourceMap);
			sourceMap.applySourceMap(innerSourceMap, this._name);
			sourceMap = sourceMap.toJSON();
		}
		return SourceNode.fromStringWithSourceMap(this._value, new SourceMapConsumer(sourceMap));
	}

	listMap(options) {
		options = options || {};
		if(options.module === false)
			return new SourceListMap(this._value, this._name, this._value);
		return fromStringWithSourceMap(this._value, typeof this._sourceMap === "string" ? JSON.parse(this._sourceMap) : this._sourceMap);
	}

	updateHash(hash) {
		hash.update(this._value);
		if(this._originalSource)
			hash.update(this._originalSource);
	}
}

require("./SourceAndMapMixin")(SourceMapSource.prototype);

module.exports = SourceMapSource;

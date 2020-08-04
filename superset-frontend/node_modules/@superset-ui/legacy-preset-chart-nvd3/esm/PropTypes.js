"use strict";

exports.__esModule = true;
exports.annotationLayerType = exports.bulletDataType = exports.boxPlotValueType = exports.categoryAndValueXYType = exports.numericXYType = exports.rgbObjectType = exports.stringOrObjectWithLabelType = exports.numberOrAutoType = void 0;

var _propTypes = _interopRequireDefault(require("prop-types"));

var _AnnotationTypes = require("./vendor/superset/AnnotationTypes");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

/* eslint-disable react/sort-prop-types */
const numberOrAutoType = _propTypes.default.oneOfType([_propTypes.default.number, _propTypes.default.oneOf(['auto'])]);

exports.numberOrAutoType = numberOrAutoType;

const stringOrObjectWithLabelType = _propTypes.default.oneOfType([_propTypes.default.string, _propTypes.default.shape({
  label: _propTypes.default.string
})]);

exports.stringOrObjectWithLabelType = stringOrObjectWithLabelType;

const rgbObjectType = _propTypes.default.shape({
  r: _propTypes.default.number.isRequired,
  g: _propTypes.default.number.isRequired,
  b: _propTypes.default.number.isRequired
});

exports.rgbObjectType = rgbObjectType;

const numericXYType = _propTypes.default.shape({
  x: _propTypes.default.number,
  y: _propTypes.default.number
});

exports.numericXYType = numericXYType;

const categoryAndValueXYType = _propTypes.default.shape({
  x: _propTypes.default.string,
  y: _propTypes.default.number
});

exports.categoryAndValueXYType = categoryAndValueXYType;

const boxPlotValueType = _propTypes.default.shape({
  outliers: _propTypes.default.arrayOf(_propTypes.default.number),
  Q1: _propTypes.default.number,
  Q2: _propTypes.default.number,
  Q3: _propTypes.default.number,
  whisker_high: _propTypes.default.number,
  whisker_low: _propTypes.default.number
});

exports.boxPlotValueType = boxPlotValueType;

const bulletDataType = _propTypes.default.shape({
  markerLabels: _propTypes.default.arrayOf(_propTypes.default.string),
  markerLineLabels: _propTypes.default.arrayOf(_propTypes.default.string),
  markerLines: _propTypes.default.arrayOf(_propTypes.default.number),
  markers: _propTypes.default.arrayOf(_propTypes.default.number),
  measures: _propTypes.default.arrayOf(_propTypes.default.number),
  rangeLabels: _propTypes.default.arrayOf(_propTypes.default.string),
  ranges: _propTypes.default.arrayOf(_propTypes.default.number)
});

exports.bulletDataType = bulletDataType;

const annotationLayerType = _propTypes.default.shape({
  annotationType: _propTypes.default.oneOf(Object.keys(_AnnotationTypes.ANNOTATION_TYPES)),
  color: _propTypes.default.string,
  hideLine: _propTypes.default.bool,
  name: _propTypes.default.string,
  opacity: _propTypes.default.string,
  show: _propTypes.default.bool,
  showMarkers: _propTypes.default.bool,
  sourceType: _propTypes.default.string,
  style: _propTypes.default.string,
  value: _propTypes.default.oneOfType([_propTypes.default.number, _propTypes.default.string]),
  width: _propTypes.default.number
});

exports.annotationLayerType = annotationLayerType;
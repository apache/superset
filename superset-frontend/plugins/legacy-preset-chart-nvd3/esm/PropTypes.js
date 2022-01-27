(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;}; /**
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
import PropTypes from 'prop-types';
import { ANNOTATION_TYPES } from './vendor/superset/AnnotationTypes';

export const numberOrAutoType = PropTypes.oneOfType([
PropTypes.number,
PropTypes.oneOf(['auto'])]);


export const stringOrObjectWithLabelType = PropTypes.oneOfType([
PropTypes.string,
PropTypes.shape({
  label: PropTypes.string })]);



export const rgbObjectType = PropTypes.shape({
  r: PropTypes.number.isRequired,
  g: PropTypes.number.isRequired,
  b: PropTypes.number.isRequired });


export const numericXYType = PropTypes.shape({
  x: PropTypes.number,
  y: PropTypes.number });


export const categoryAndValueXYType = PropTypes.shape({
  x: PropTypes.string,
  y: PropTypes.number });


export const boxPlotValueType = PropTypes.shape({
  outliers: PropTypes.arrayOf(PropTypes.number),
  Q1: PropTypes.number,
  Q2: PropTypes.number,
  Q3: PropTypes.number,
  whisker_high: PropTypes.number,
  whisker_low: PropTypes.number });


export const bulletDataType = PropTypes.shape({
  markerLabels: PropTypes.arrayOf(PropTypes.string),
  markerLineLabels: PropTypes.arrayOf(PropTypes.string),
  markerLines: PropTypes.arrayOf(PropTypes.number),
  markers: PropTypes.arrayOf(PropTypes.number),
  measures: PropTypes.arrayOf(PropTypes.number),
  rangeLabels: PropTypes.arrayOf(PropTypes.string),
  ranges: PropTypes.arrayOf(PropTypes.number) });


export const annotationLayerType = PropTypes.shape({
  annotationType: PropTypes.oneOf(Object.keys(ANNOTATION_TYPES)),
  color: PropTypes.string,
  hideLine: PropTypes.bool,
  name: PropTypes.string,
  opacity: PropTypes.string,
  show: PropTypes.bool,
  showMarkers: PropTypes.bool,
  sourceType: PropTypes.string,
  style: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  width: PropTypes.number });;(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(numberOrAutoType, "numberOrAutoType", "/Users/evan/GitHub/superset/superset-frontend/plugins/legacy-preset-chart-nvd3/src/PropTypes.js");reactHotLoader.register(stringOrObjectWithLabelType, "stringOrObjectWithLabelType", "/Users/evan/GitHub/superset/superset-frontend/plugins/legacy-preset-chart-nvd3/src/PropTypes.js");reactHotLoader.register(rgbObjectType, "rgbObjectType", "/Users/evan/GitHub/superset/superset-frontend/plugins/legacy-preset-chart-nvd3/src/PropTypes.js");reactHotLoader.register(numericXYType, "numericXYType", "/Users/evan/GitHub/superset/superset-frontend/plugins/legacy-preset-chart-nvd3/src/PropTypes.js");reactHotLoader.register(categoryAndValueXYType, "categoryAndValueXYType", "/Users/evan/GitHub/superset/superset-frontend/plugins/legacy-preset-chart-nvd3/src/PropTypes.js");reactHotLoader.register(boxPlotValueType, "boxPlotValueType", "/Users/evan/GitHub/superset/superset-frontend/plugins/legacy-preset-chart-nvd3/src/PropTypes.js");reactHotLoader.register(bulletDataType, "bulletDataType", "/Users/evan/GitHub/superset/superset-frontend/plugins/legacy-preset-chart-nvd3/src/PropTypes.js");reactHotLoader.register(annotationLayerType, "annotationLayerType", "/Users/evan/GitHub/superset/superset-frontend/plugins/legacy-preset-chart-nvd3/src/PropTypes.js");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();
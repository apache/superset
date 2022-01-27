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
function extractTypes(metadata) {
  return Object.keys(metadata).reduce((prev, key) => {
    const result = prev;
    result[key] = key;

    return result;
  }, {});
}

export const ANNOTATION_TYPES_METADATA = {
  FORMULA: {
    value: 'FORMULA',
    label: 'Formula' },

  EVENT: {
    value: 'EVENT',
    label: 'Event',
    supportNativeSource: true },

  INTERVAL: {
    value: 'INTERVAL',
    label: 'Interval',
    supportNativeSource: true },

  TIME_SERIES: {
    value: 'TIME_SERIES',
    label: 'Time Series' } };



export const ANNOTATION_TYPES = extractTypes(ANNOTATION_TYPES_METADATA);

export const DEFAULT_ANNOTATION_TYPE = ANNOTATION_TYPES.FORMULA;

export const ANNOTATION_SOURCE_TYPES_METADATA = {
  NATIVE: {
    value: 'NATIVE',
    label: 'Superset annotation' } };



export const ANNOTATION_SOURCE_TYPES = extractTypes(
ANNOTATION_SOURCE_TYPES_METADATA);


export function requiresQuery(annotationSourceType) {
  return !!annotationSourceType;
}

const NATIVE_COLUMN_NAMES = {
  descriptionColumns: ['long_descr'],
  intervalEndColumn: 'end_dttm',
  timeColumn: 'start_dttm',
  titleColumn: 'short_descr' };


export function applyNativeColumns(annotation) {
  if (annotation.sourceType === ANNOTATION_SOURCE_TYPES.NATIVE) {
    return { ...annotation, ...NATIVE_COLUMN_NAMES };
  }

  return annotation;
}const _default =

ANNOTATION_TYPES;export default _default;;(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(extractTypes, "extractTypes", "/Users/evan/GitHub/superset/superset-frontend/plugins/legacy-preset-chart-nvd3/src/vendor/superset/AnnotationTypes.js");reactHotLoader.register(ANNOTATION_TYPES_METADATA, "ANNOTATION_TYPES_METADATA", "/Users/evan/GitHub/superset/superset-frontend/plugins/legacy-preset-chart-nvd3/src/vendor/superset/AnnotationTypes.js");reactHotLoader.register(ANNOTATION_TYPES, "ANNOTATION_TYPES", "/Users/evan/GitHub/superset/superset-frontend/plugins/legacy-preset-chart-nvd3/src/vendor/superset/AnnotationTypes.js");reactHotLoader.register(DEFAULT_ANNOTATION_TYPE, "DEFAULT_ANNOTATION_TYPE", "/Users/evan/GitHub/superset/superset-frontend/plugins/legacy-preset-chart-nvd3/src/vendor/superset/AnnotationTypes.js");reactHotLoader.register(ANNOTATION_SOURCE_TYPES_METADATA, "ANNOTATION_SOURCE_TYPES_METADATA", "/Users/evan/GitHub/superset/superset-frontend/plugins/legacy-preset-chart-nvd3/src/vendor/superset/AnnotationTypes.js");reactHotLoader.register(ANNOTATION_SOURCE_TYPES, "ANNOTATION_SOURCE_TYPES", "/Users/evan/GitHub/superset/superset-frontend/plugins/legacy-preset-chart-nvd3/src/vendor/superset/AnnotationTypes.js");reactHotLoader.register(requiresQuery, "requiresQuery", "/Users/evan/GitHub/superset/superset-frontend/plugins/legacy-preset-chart-nvd3/src/vendor/superset/AnnotationTypes.js");reactHotLoader.register(NATIVE_COLUMN_NAMES, "NATIVE_COLUMN_NAMES", "/Users/evan/GitHub/superset/superset-frontend/plugins/legacy-preset-chart-nvd3/src/vendor/superset/AnnotationTypes.js");reactHotLoader.register(applyNativeColumns, "applyNativeColumns", "/Users/evan/GitHub/superset/superset-frontend/plugins/legacy-preset-chart-nvd3/src/vendor/superset/AnnotationTypes.js");reactHotLoader.register(_default, "default", "/Users/evan/GitHub/superset/superset-frontend/plugins/legacy-preset-chart-nvd3/src/vendor/superset/AnnotationTypes.js");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();
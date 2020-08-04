"use strict";

exports.__esModule = true;
exports.requiresQuery = requiresQuery;
exports.applyNativeColumns = applyNativeColumns;
exports.default = exports.ANNOTATION_SOURCE_TYPES = exports.ANNOTATION_SOURCE_TYPES_METADATA = exports.DEFAULT_ANNOTATION_TYPE = exports.ANNOTATION_TYPES = exports.ANNOTATION_TYPES_METADATA = void 0;

function _extends() { _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends.apply(this, arguments); }

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
function extractTypes(metadata) {
  return Object.keys(metadata).reduce((prev, key) => {
    const result = prev;
    result[key] = key;
    return result;
  }, {});
}

const ANNOTATION_TYPES_METADATA = {
  FORMULA: {
    value: 'FORMULA',
    label: 'Formula'
  },
  EVENT: {
    value: 'EVENT',
    label: 'Event',
    supportNativeSource: true
  },
  INTERVAL: {
    value: 'INTERVAL',
    label: 'Interval',
    supportNativeSource: true
  },
  TIME_SERIES: {
    value: 'TIME_SERIES',
    label: 'Time Series'
  }
};
exports.ANNOTATION_TYPES_METADATA = ANNOTATION_TYPES_METADATA;
const ANNOTATION_TYPES = extractTypes(ANNOTATION_TYPES_METADATA);
exports.ANNOTATION_TYPES = ANNOTATION_TYPES;
const DEFAULT_ANNOTATION_TYPE = ANNOTATION_TYPES.FORMULA;
exports.DEFAULT_ANNOTATION_TYPE = DEFAULT_ANNOTATION_TYPE;
const ANNOTATION_SOURCE_TYPES_METADATA = {
  NATIVE: {
    value: 'NATIVE',
    label: 'Superset annotation'
  }
};
exports.ANNOTATION_SOURCE_TYPES_METADATA = ANNOTATION_SOURCE_TYPES_METADATA;
const ANNOTATION_SOURCE_TYPES = extractTypes(ANNOTATION_SOURCE_TYPES_METADATA);
exports.ANNOTATION_SOURCE_TYPES = ANNOTATION_SOURCE_TYPES;

function requiresQuery(annotationSourceType) {
  return !!annotationSourceType;
}

const NATIVE_COLUMN_NAMES = {
  descriptionColumns: ['long_descr'],
  intervalEndColumn: 'end_dttm',
  timeColumn: 'start_dttm',
  titleColumn: 'short_descr'
};

function applyNativeColumns(annotation) {
  if (annotation.sourceType === ANNOTATION_SOURCE_TYPES.NATIVE) {
    return _extends({}, annotation, {}, NATIVE_COLUMN_NAMES);
  }

  return annotation;
}

var _default = ANNOTATION_TYPES;
exports.default = _default;
"use strict";

exports.__esModule = true;
exports.commonLayerProps = commonLayerProps;
exports.getAggFunc = getAggFunc;

var d3array = _interopRequireWildcard(require("d3-array"));

var _sandbox = _interopRequireDefault(require("../utils/sandbox"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _getRequireWildcardCache() { if (typeof WeakMap !== "function") return null; var cache = new WeakMap(); _getRequireWildcardCache = function _getRequireWildcardCache() { return cache; }; return cache; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

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
function commonLayerProps(formData, setTooltip, setTooltipContent, onSelect) {
  const fd = formData;
  let onHover;
  let tooltipContentGenerator = setTooltipContent;

  if (fd.js_tooltip) {
    tooltipContentGenerator = (0, _sandbox.default)(fd.js_tooltip);
  }

  if (tooltipContentGenerator) {
    onHover = o => {
      if (o.picked) {
        setTooltip({
          content: tooltipContentGenerator(o),
          x: o.x,
          y: o.y
        });
      } else {
        setTooltip(null);
      }
    };
  }

  let onClick;

  if (fd.js_onclick_href) {
    onClick = o => {
      const href = (0, _sandbox.default)(fd.js_onclick_href)(o);
      window.open(href);
    };
  } else if (fd.table_filter && onSelect !== undefined) {
    onClick = o => onSelect(o.object[fd.line_column]);
  }

  return {
    onClick,
    onHover,
    pickable: Boolean(onHover)
  };
}

const percentiles = {
  p1: 0.01,
  p5: 0.05,
  p95: 0.95,
  p99: 0.99
};
/* Get an a stat function that operates on arrays, aligns with control=js_agg_function  */

function getAggFunc(type, accessor) {
  if (type === void 0) {
    type = 'sum';
  }

  if (accessor === void 0) {
    accessor = null;
  }

  if (type === 'count') {
    return arr => arr.length;
  }

  let d3func;

  if (type in percentiles) {
    d3func = (arr, acc) => {
      let sortedArr;

      if (accessor) {
        sortedArr = arr.sort((o1, o2) => d3array.ascending(accessor(o1), accessor(o2)));
      } else {
        sortedArr = arr.sort(d3array.ascending);
      }

      return d3array.quantile(sortedArr, percentiles[type], acc);
    };
  } else {
    d3func = d3array[type];
  }

  if (!accessor) {
    return arr => d3func(arr);
  }

  return arr => d3func(arr.map(x => accessor(x)));
}
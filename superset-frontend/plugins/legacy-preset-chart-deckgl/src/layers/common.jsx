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
import * as d3array from 'd3-array';
import sandboxedEval from '../utils/sandbox';

export function commonLayerProps(
  formData,
  setTooltip,
  setTooltipContent,
  onSelect,
) {
  const fd = formData;
  let onHover;
  let tooltipContentGenerator = setTooltipContent;
  if (fd.js_tooltip) {
    tooltipContentGenerator = sandboxedEval(fd.js_tooltip);
  }
  if (tooltipContentGenerator) {
    onHover = o => {
      if (o.picked) {
        setTooltip({
          content: tooltipContentGenerator(o),
          x: o.x,
          y: o.y,
        });
      } else {
        setTooltip(null);
      }
    };
  }
  let onClick;
  if (fd.js_onclick_href) {
    onClick = o => {
      const href = sandboxedEval(fd.js_onclick_href)(o);
      window.open(href);
    };
  } else if (fd.table_filter && onSelect !== undefined) {
    onClick = o => onSelect(o.object[fd.line_column]);
  }

  return {
    onClick,
    onHover,
    pickable: Boolean(onHover),
  };
}

const percentiles = {
  p1: 0.01,
  p5: 0.05,
  p95: 0.95,
  p99: 0.99,
};

/* Get an a stat function that operates on arrays, aligns with control=js_agg_function  */
export function getAggFunc(type = 'sum', accessor = null) {
  if (type === 'count') {
    return arr => arr.length;
  }
  let d3func;
  if (type in percentiles) {
    d3func = (arr, acc) => {
      let sortedArr;
      if (accessor) {
        sortedArr = arr.sort((o1, o2) =>
          d3array.ascending(accessor(o1), accessor(o2)),
        );
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

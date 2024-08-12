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
import { ReactNode } from 'react';
import * as d3array from 'd3-array';
import { JsonObject, JsonValue, QueryFormData } from '@superset-ui/core';
import sandboxedEval from '../utils/sandbox';
import { TooltipProps } from '../components/Tooltip';

export function commonLayerProps(
  formData: QueryFormData,
  setTooltip: (tooltip: TooltipProps['tooltip']) => void,
  setTooltipContent: (content: JsonObject) => ReactNode,
  onSelect?: (value: JsonValue) => void,
) {
  const fd = formData;
  let onHover;
  let tooltipContentGenerator = setTooltipContent;
  if (fd.js_tooltip) {
    tooltipContentGenerator = sandboxedEval(fd.js_tooltip);
  }
  if (tooltipContentGenerator) {
    onHover = (o: JsonObject) => {
      if (o.picked) {
        setTooltip({
          content: tooltipContentGenerator(o),
          x: o.x,
          y: o.y,
        });
      } else {
        setTooltip(null);
      }
      return true;
    };
  }
  let onClick;
  if (fd.js_onclick_href) {
    onClick = (o: any) => {
      const href = sandboxedEval(fd.js_onclick_href)(o);
      window.open(href);
      return true;
    };
  } else if (fd.table_filter && onSelect !== undefined) {
    onClick = (o: any) => {
      onSelect(o.object[fd.line_column]);
      return true;
    };
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

/* Get a stat function that operates on arrays, aligns with control=js_agg_function  */
export function getAggFunc(
  type = 'sum',
  accessor: ((object: any) => number | undefined) | null = null,
) {
  if (type === 'count') {
    return (arr: number[]) => arr.length;
  }
  let d3func: (
    iterable: Array<unknown>,
    accessor?: (object: JsonObject) => number | undefined,
  ) => number[] | number | undefined;
  if (type in percentiles) {
    d3func = (arr, acc: (object: JsonObject) => number | undefined) => {
      let sortedArr;
      if (accessor) {
        sortedArr = arr.sort((o1: JsonObject, o2: JsonObject) =>
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
    return (arr: JsonObject[]) => d3func(arr);
  }

  return (arr: JsonObject[]) => d3func(arr.map(x => accessor(x)));
}

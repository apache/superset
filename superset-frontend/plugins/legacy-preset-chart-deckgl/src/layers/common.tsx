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
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS
 * OF ANY KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import { ReactNode } from 'react';
import {
  ascending as d3ascending,
  quantile as d3quantile,
  sum as d3sum,
  mean as d3mean,
  min as d3min,
  max as d3max,
  median as d3median,
  variance as d3variance,
  deviation as d3deviation,
} from 'd3-array';
import {
  CategoricalColorScale,
  FilterState,
  HandlerFunction,
  JsonObject,
  JsonValue,
  QueryFormData,
  SetDataMaskHook,
} from '@superset-ui/core';
import { Layer, PickingInfo, Color } from '@deck.gl/core';
import { ScaleLinear } from 'd3-scale';
import { ColorBreakpointType } from '../types';
import sandboxedEval from '../utils/sandbox';
import { TooltipProps } from '../components/Tooltip';
import { getCrossFilterDataMask } from '../utils/crossFiltersDataMask';
import { COLOR_SCHEME_TYPES, ColorSchemeType } from '../utilities/utils';
import { hexToRGB } from '../utils/colors';
import { DEFAULT_DECKGL_COLOR } from '../utilities/Shared_DeckGL';

export function commonLayerProps({
  formData,
  setDataMask,
  setTooltip,
  setTooltipContent,
  onSelect,
  onContextMenu,
  filterState,
  emitCrossFilters,
}: {
  formData: QueryFormData;
  setDataMask?: SetDataMaskHook;
  setTooltip: (tooltip: TooltipProps['tooltip']) => void;
  setTooltipContent: (content: JsonObject) => ReactNode;
  onSelect?: (value: JsonValue) => void;
  filterState?: FilterState;
  onContextMenu?: HandlerFunction;
  emitCrossFilters?: boolean;
}) {
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
  } else if (emitCrossFilters) {
    onClick = (data: PickingInfo, event: any) => {
      const crossFilters = getCrossFilterDataMask({
        data,
        filterState,
        formData,
      });

      if (event.leftButton && setDataMask !== undefined && crossFilters) {
        setDataMask(crossFilters.dataMask);
      } else if (event.rightButton && onContextMenu !== undefined) {
        onContextMenu(event.center.x, event.center.y, {
          drillToDetail: [],
          crossFilter: crossFilters,
          drillBy: {},
        });
      }

      return true;
    };
  }

  return {
    onClick: onClick as Layer['onClick'],
    onHover,
    pickable: Boolean(onHover || onClick),
  };
}

const percentiles = {
  p1: 0.01,
  p5: 0.05,
  p95: 0.95,
  p99: 0.99,
};

/* Supported d3-array functions */
const d3functions: Record<string, any> = {
  sum: d3sum,
  min: d3min,
  max: d3max,
  mean: d3mean,
  median: d3median,
  variance: d3variance,
  deviation: d3deviation,
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
          d3ascending(accessor(o1), accessor(o2)),
        );
      } else {
        sortedArr = arr.sort(d3ascending);
      }

      return d3quantile(
        sortedArr,
        percentiles[type as keyof typeof percentiles],
        acc,
      );
    };
  } else if (type in d3functions) {
    d3func = d3functions[type];
  } else {
    throw new Error(`Unsupported aggregation type: ${type}`);
  }

  if (!accessor) {
    return (arr: number[]) => d3func(arr);
  }

  return (arr: number[]) => d3func(arr.map(x => accessor(x)));
}

export const getColorForBreakpoints = (
  aggFunc: (arr: number[]) => number | number[] | undefined,
  point: number[],
  colorBreakpoints: ColorBreakpointType[],
) => {
  const aggResult = aggFunc(point);

  if (aggResult === undefined) return undefined;

  if (Array.isArray(aggResult)) return undefined;

  const breapointForPoint = colorBreakpoints.findIndex(
    breakpoint =>
      aggResult >= breakpoint.minValue && aggResult <= breakpoint.maxValue,
  );

  return breapointForPoint + 1;
};

export const getColorRange = ({
  colorSchemeType,
  fixedColor,
  colorBreakpoints,
  colorScale,
  defaultBreakpointsColor,
}: {
  colorSchemeType: ColorSchemeType;
  defaultBreakpointsColor: { r: number; g: number; b: number; a: number };
  fixedColor?: { r: number; g: number; b: number; a: number };
  colorBreakpoints?: ColorBreakpointType[];
  colorScale?: CategoricalColorScale | ScaleLinear<string, string>;
}) => {
  let colorRange: Color[] | undefined;
  switch (colorSchemeType) {
    case COLOR_SCHEME_TYPES.linear_palette:
    case COLOR_SCHEME_TYPES.categorical_palette: {
      colorRange = colorScale?.range().map(color => hexToRGB(color)) as Color[];
      break;
    }
    case COLOR_SCHEME_TYPES.color_breakpoints: {
      const defaultColorArray: Color = defaultBreakpointsColor
        ? [
            defaultBreakpointsColor.r,
            defaultBreakpointsColor.g,
            defaultBreakpointsColor.b,
            defaultBreakpointsColor.a * 255,
          ]
        : [
            DEFAULT_DECKGL_COLOR.r,
            DEFAULT_DECKGL_COLOR.g,
            DEFAULT_DECKGL_COLOR.b,
            DEFAULT_DECKGL_COLOR.a * 255,
          ];

      colorRange = colorBreakpoints?.map(
        (colorBreakpoint: ColorBreakpointType) =>
          colorBreakpoint.color
            ? [
                colorBreakpoint.color.r,
                colorBreakpoint.color.g,
                colorBreakpoint.color.b,
                colorBreakpoint.color.a * 255,
              ]
            : defaultColorArray,
      );
      colorRange?.unshift(defaultColorArray);

      break;
    }
    default: {
      const color = fixedColor || {
        r: DEFAULT_DECKGL_COLOR.r,
        g: DEFAULT_DECKGL_COLOR.g,
        b: DEFAULT_DECKGL_COLOR.b,
        a: DEFAULT_DECKGL_COLOR.a,
      };

      colorRange = [[color.r, color.g, color.b, color.a * 255]];
    }
  }

  return colorRange;
};

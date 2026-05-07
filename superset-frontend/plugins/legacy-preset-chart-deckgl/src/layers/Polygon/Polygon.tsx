/* eslint-disable react/sort-prop-types */
/* eslint-disable react/jsx-handler-names */
/* eslint-disable react/no-access-state-in-setstate */
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
/* eslint no-underscore-dangle: ["error", { "allow": ["", "__timestamp"] }] */

import { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  ContextMenuFilters,
  FilterState,
  HandlerFunction,
  JsonObject,
  JsonValue,
  QueryFormData,
  SetDataMaskHook,
  t,
} from '@superset-ui/core';

import { PolygonLayer } from '@deck.gl/layers';

import { Color } from '@deck.gl/core';
import Legend from '../../components/Legend';
import TooltipRow from '../../TooltipRow';
import {
  getBuckets,
  getBreakPointColorScaler,
  getColorBreakpointsBuckets,
  TRANSPARENT_COLOR_ARRAY,
} from '../../utils';

import { commonLayerProps, getColorForBreakpoints } from '../common';
import sandboxedEval from '../../utils/sandbox';
import getPointsFromPolygon from '../../utils/getPointsFromPolygon';
import fitViewport, { Viewport } from '../../utils/fitViewport';
import {
  DeckGLContainerHandle,
  DeckGLContainerStyledWrapper,
} from '../../DeckGLContainer';
import { TooltipProps } from '../../components/Tooltip';
import { GetLayerType } from '../../factory';
import { COLOR_SCHEME_TYPES } from '../../utilities/utils';
import { DEFAULT_DECKGL_COLOR } from '../../utilities/Shared_DeckGL';
import { Point } from '../../types';

function getElevation(
  d: JsonObject,
  colorScaler: (d: JsonObject) => [number, number, number, number],
) {
  /* in deck.gl 5.3.4 (used in Superset as of 2018-10-24), if a polygon has
   * opacity zero it will make everything behind it have opacity zero,
   * effectively showing the map layer no matter what other polygons are
   * behind it.
   */
  return colorScaler(d)[3] === 0 ? 0 : d.elevation;
}

function setTooltipContent(formData: PolygonFormData) {
  return (o: JsonObject) => {
    const metricLabel = formData?.metric?.label || formData?.metric;

    return (
      <div className="deckgl-tooltip">
        {o.object?.name && (
          <TooltipRow
            // eslint-disable-next-line prefer-template
            label={t('name') + ': '}
            value={`${o.object.name}`}
          />
        )}
        {o.object?.[formData?.line_column] && (
          <TooltipRow
            label={`${formData.line_column}: `}
            value={`${o.object[formData.line_column]}`}
          />
        )}
        {formData?.metric && (
          <TooltipRow
            label={`${metricLabel}: `}
            value={`${o.object?.[metricLabel]}`}
          />
        )}
      </div>
    );
  };
}

export const getLayer: GetLayerType<PolygonLayer> = function ({
  formData,
  payload,
  setTooltip,
  filterState,
  setDataMask,
  onContextMenu,
  onSelect,
  emitCrossFilters,
}) {
  const fd = formData as PolygonFormData;
  const fc: { r: number; g: number; b: number; a: number } =
    fd.fill_color_picker;
  const sc: { r: number; g: number; b: number; a: number } =
    fd.stroke_color_picker;
  const defaultBreakpointColor = fd.deafult_breakpoint_color;
  let data = [...payload.data.features];

  if (fd.js_data_mutator) {
    // Applying user defined data mutator if defined
    const jsFnMutator = sandboxedEval(fd.js_data_mutator);
    data = jsFnMutator(data);
  }

  const colorSchemeType = fd.color_scheme_type;

  const metricLabel = fd.metric ? fd.metric.label || fd.metric : null;
  const accessor = (d: JsonObject) => d[metricLabel];
  let baseColorScaler: (d: JsonObject) => Color;

  switch (colorSchemeType) {
    case COLOR_SCHEME_TYPES.fixed_color: {
      baseColorScaler = () => [fc.r, fc.g, fc.b, 255 * fc.a];
      break;
    }
    case COLOR_SCHEME_TYPES.linear_palette: {
      baseColorScaler =
        fd.metric === null
          ? () => [fc.r, fc.g, fc.b, 255 * fc.a]
          : getBreakPointColorScaler(fd, data, accessor);
      break;
    }
    case COLOR_SCHEME_TYPES.color_breakpoints: {
      const colorBreakpoints = fd.color_breakpoints;
      baseColorScaler = data => {
        const breakpointIndex = getColorForBreakpoints(
          accessor,
          data as number[],
          colorBreakpoints,
        );
        const breakpointColor =
          breakpointIndex !== undefined &&
          colorBreakpoints[breakpointIndex - 1]?.color;
        return breakpointColor
          ? [breakpointColor.r, breakpointColor.g, breakpointColor.b, 255]
          : defaultBreakpointColor
            ? [
                defaultBreakpointColor.r,
                defaultBreakpointColor.g,
                defaultBreakpointColor.b,
                defaultBreakpointColor.a * 255,
              ]
            : [
                DEFAULT_DECKGL_COLOR.r,
                DEFAULT_DECKGL_COLOR.g,
                DEFAULT_DECKGL_COLOR.b,
                DEFAULT_DECKGL_COLOR.a * 255,
              ];
      };
      break;
    }

    default:
      baseColorScaler = () => [fc.r, fc.g, fc.b, 255 * fc.a];
      break;
  }

  // when polygons are selected, reduce the opacity of non-selected polygons
  const colorScaler = (d: {
    polygon: Point[];
  }): [number, number, number, number] => {
    const baseColor =
      (baseColorScaler(d) as [number, number, number, number]) ||
      TRANSPARENT_COLOR_ARRAY;
    const polygonPoints = getPointsFromPolygon(d);

    const isPolygonFilterSelected =
      JSON.stringify(polygonPoints).replaceAll(' ', '') ===
      filterState?.value?.[0];

    if (filterState?.value && !isPolygonFilterSelected) {
      baseColor[3] /= 3;
    }

    return baseColor;
  };

  const tooltipContentGenerator =
    fd.line_column &&
    fd.metric &&
    ['json', 'geohash', 'zipcode'].includes(fd.line_type)
      ? setTooltipContent(fd)
      : () => null;

  return new PolygonLayer({
    id: `path-layer-${fd.slice_id}` as const,
    data,
    filled: fd.filled,
    stroked: fd.stroked,
    getPolygon: getPointsFromPolygon,
    getFillColor: colorScaler,
    getLineColor: sc ? [sc.r, sc.g, sc.b, 255 * sc.a] : undefined,
    getLineWidth: fd.line_width,
    extruded: fd.extruded,
    lineWidthUnits: fd.line_width_unit,
    getElevation: (d: JsonObject) => getElevation(d, colorScaler),
    elevationScale: fd.multiplier,
    fp64: true,
    opacity: fd.opacity ? fd.opacity / 100 : 1,
    ...commonLayerProps({
      formData: fd,
      setTooltip,
      setTooltipContent: tooltipContentGenerator,
      onSelect,
      filterState,
      onContextMenu,
      setDataMask,
      emitCrossFilters,
    }),
  });
};

export type PolygonFormData = QueryFormData & {
  break_points: string[];
  num_buckets: string;
  linear_color_scheme: string | string[];
  opacity: number;
};
export type DeckGLPolygonProps = {
  formData: PolygonFormData;
  payload: JsonObject;
  setControlValue: (control: string, value: JsonValue) => void;
  viewport: Viewport;
  onAddFilter: HandlerFunction;
  width: number;
  height: number;
  onContextMenu?: (
    clientX: number,
    clientY: number,
    filters?: ContextMenuFilters,
  ) => void;
  setDataMask?: SetDataMaskHook;
  filterState?: FilterState;
  emitCrossFilters?: boolean;
};

export function getPoints(data: JsonObject[]) {
  return data.flatMap(getPointsFromPolygon);
}

const DeckGLPolygon = (props: DeckGLPolygonProps) => {
  const containerRef = useRef<DeckGLContainerHandle>();

  const getAdjustedViewport = useCallback(() => {
    let viewport = { ...props.viewport };
    if (props.formData.autozoom) {
      const features = props.payload.data.features || [];
      viewport = fitViewport(viewport, {
        width: props.width,
        height: props.height,
        points: getPoints(features),
      });
    }
    if (viewport.zoom < 0) {
      viewport.zoom = 0;
    }
    return viewport;
  }, [props]);

  const [viewport, setViewport] = useState(getAdjustedViewport());
  const [stateFormData, setStateFormData] = useState(props.payload.form_data);

  useEffect(() => {
    const { payload } = props;

    if (payload.form_data !== stateFormData) {
      setViewport(getAdjustedViewport());
      setStateFormData(payload.form_data);
    }
  }, [getAdjustedViewport, props, stateFormData, viewport]);

  const setTooltip = useCallback((tooltip: TooltipProps['tooltip']) => {
    const { current } = containerRef;
    if (current) {
      current.setTooltip(tooltip);
    }
  }, []);

  const getLayers = useCallback(() => {
    const {
      formData,
      payload,
      onAddFilter,
      onContextMenu,
      setDataMask,
      filterState,
      emitCrossFilters,
    } = props;

    if (props.payload.data.features === undefined) {
      return [];
    }

    const layer = getLayer({
      formData,
      payload,
      onAddFilter,
      setTooltip,
      onContextMenu,
      setDataMask,
      filterState,
      emitCrossFilters,
    });

    return [layer];
  }, [setTooltip, props]);

  const { payload, formData, setControlValue } = props;

  const metricLabel = formData.metric
    ? formData.metric.label || formData.metric
    : null;
  const accessor = (d: JsonObject) => d[metricLabel];

  const colorSchemeType = formData.color_scheme_type;
  const buckets =
    colorSchemeType === COLOR_SCHEME_TYPES.color_breakpoints
      ? getColorBreakpointsBuckets(formData.color_breakpoints)
      : getBuckets(formData, payload.data.features, accessor);

  return (
    <div style={{ position: 'relative' }}>
      <DeckGLContainerStyledWrapper
        ref={containerRef}
        viewport={viewport}
        layers={getLayers()}
        setControlValue={setControlValue}
        mapStyle={formData.mapbox_style}
        mapboxApiAccessToken={payload.data.mapboxApiKey}
        width={props.width}
        height={props.height}
      />

      {formData.metric !== null && (
        <Legend
          categories={buckets}
          position={formData.legend_position}
          format={formData.legend_format}
        />
      )}
    </div>
  );
};

export default memo(DeckGLPolygon);

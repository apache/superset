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
  HandlerFunction,
  JsonObject,
  JsonValue,
  QueryFormData,
  t,
} from '@superset-ui/core';

import { PolygonLayer } from 'deck.gl/typed';

import Legend from '../../components/Legend';
import TooltipRow from '../../TooltipRow';
import { getBuckets, getBreakPointColorScaler } from '../../utils';

import { commonLayerProps } from '../common';
import sandboxedEval from '../../utils/sandbox';
import getPointsFromPolygon from '../../utils/getPointsFromPolygon';
import fitViewport, { Viewport } from '../../utils/fitViewport';
import {
  DeckGLContainerHandle,
  DeckGLContainerStyledWrapper,
} from '../../DeckGLContainer';
import { TooltipProps } from '../../components/Tooltip';

const DOUBLE_CLICK_THRESHOLD = 250; // milliseconds

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

export function getLayer(
  formData: PolygonFormData,
  payload: JsonObject,
  onAddFilter: HandlerFunction,
  setTooltip: (tooltip: TooltipProps['tooltip']) => void,
  selected: JsonObject[],
  onSelect: (value: JsonValue) => void,
) {
  const fd = formData;
  const fc = fd.fill_color_picker;
  const sc = fd.stroke_color_picker;
  let data = [...payload.data.features];

  if (fd.js_data_mutator) {
    // Applying user defined data mutator if defined
    const jsFnMutator = sandboxedEval(fd.js_data_mutator);
    data = jsFnMutator(data);
  }

  const metricLabel = fd.metric ? fd.metric.label || fd.metric : null;
  const accessor = (d: JsonObject) => d[metricLabel];
  // base color for the polygons
  const baseColorScaler =
    fd.metric === null
      ? () => [fc.r, fc.g, fc.b, 255 * fc.a]
      : getBreakPointColorScaler(fd, data, accessor);

  // when polygons are selected, reduce the opacity of non-selected polygons
  const colorScaler = (d: JsonObject): [number, number, number, number] => {
    const baseColor = (baseColorScaler?.(d) as [
      number,
      number,
      number,
      number,
    ]) || [0, 0, 0, 0];
    if (selected.length > 0 && !selected.includes(d[fd.line_column])) {
      baseColor[3] /= 2;
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
    getLineColor: [sc.r, sc.g, sc.b, 255 * sc.a],
    getLineWidth: fd.line_width,
    extruded: fd.extruded,
    lineWidthUnits: fd.line_width_unit,
    getElevation: d => getElevation(d, colorScaler),
    elevationScale: fd.multiplier,
    fp64: true,
    ...commonLayerProps(fd, setTooltip, tooltipContentGenerator, onSelect),
  });
}

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
};

const DeckGLPolygon = (props: DeckGLPolygonProps) => {
  const containerRef = useRef<DeckGLContainerHandle>();

  const getAdjustedViewport = useCallback(() => {
    let viewport = { ...props.viewport };
    if (props.formData.autozoom) {
      const features = props.payload.data.features || [];
      viewport = fitViewport(viewport, {
        width: props.width,
        height: props.height,
        points: features.flatMap(getPointsFromPolygon),
      });
    }
    if (viewport.zoom < 0) {
      viewport.zoom = 0;
    }
    return viewport;
  }, [props]);

  const [lastClick, setLastClick] = useState(0);
  const [viewport, setViewport] = useState(getAdjustedViewport());
  const [stateFormData, setStateFormData] = useState(props.payload.form_data);
  const [selected, setSelected] = useState<JsonObject[]>([]);

  useEffect(() => {
    const { payload } = props;

    if (payload.form_data !== stateFormData) {
      setViewport(getAdjustedViewport());
      setSelected([]);
      setLastClick(0);
      setStateFormData(payload.form_data);
    }
  }, [getAdjustedViewport, props, stateFormData, viewport]);

  const setTooltip = useCallback((tooltip: TooltipProps['tooltip']) => {
    const { current } = containerRef;
    if (current) {
      current.setTooltip(tooltip);
    }
  }, []);

  const onSelect = useCallback(
    (polygon: JsonObject) => {
      const { formData, onAddFilter } = props;

      const now = new Date().getDate();
      const doubleClick = now - lastClick <= DOUBLE_CLICK_THRESHOLD;

      // toggle selected polygons
      const selectedCopy = [...selected];
      if (doubleClick) {
        selectedCopy.splice(0, selectedCopy.length, polygon);
      } else if (formData.toggle_polygons) {
        const i = selectedCopy.indexOf(polygon);
        if (i === -1) {
          selectedCopy.push(polygon);
        } else {
          selectedCopy.splice(i, 1);
        }
      } else {
        selectedCopy.splice(0, 1, polygon);
      }

      setSelected(selectedCopy);
      setLastClick(now);
      if (formData.table_filter) {
        onAddFilter(formData.line_column, selected, false, true);
      }
    },
    [lastClick, props, selected],
  );

  const getLayers = useCallback(() => {
    if (props.payload.data.features === undefined) {
      return [];
    }

    const layer = getLayer(
      props.formData,
      props.payload,
      props.onAddFilter,
      setTooltip,
      selected,
      onSelect,
    );

    return [layer];
  }, [
    onSelect,
    props.formData,
    props.onAddFilter,
    props.payload,
    selected,
    setTooltip,
  ]);

  const { payload, formData, setControlValue } = props;

  const metricLabel = formData.metric
    ? formData.metric.label || formData.metric
    : null;
  const accessor = (d: JsonObject) => d[metricLabel];

  const buckets = getBuckets(formData, payload.data.features, accessor);

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

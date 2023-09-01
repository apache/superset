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

import React from 'react';
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
  DeckGLContainer,
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
    const metricLabel = formData.metric.label || formData.metric;

    return (
      <div className="deckgl-tooltip">
        {o.object.name && (
          <TooltipRow
            // eslint-disable-next-line prefer-template
            label={t('name') + ': '}
            value={`${o.object.name}`}
          />
        )}
        {o.object[formData.line_column] && (
          <TooltipRow
            label={`${formData.line_column}: `}
            value={`${o.object[formData.line_column]}`}
          />
        )}
        {formData.metric && (
          <TooltipRow
            label={`${metricLabel}: `}
            value={`${o.object[metricLabel]}`}
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

export type DeckGLPolygonState = {
  lastClick: number;
  viewport: Viewport;
  formData: PolygonFormData;
  selected: JsonObject[];
};

class DeckGLPolygon extends React.PureComponent<
  DeckGLPolygonProps,
  DeckGLPolygonState
> {
  containerRef = React.createRef<DeckGLContainer>();

  constructor(props: DeckGLPolygonProps) {
    super(props);

    this.state = DeckGLPolygon.getDerivedStateFromProps(
      props,
    ) as DeckGLPolygonState;

    this.getLayers = this.getLayers.bind(this);
    this.onSelect = this.onSelect.bind(this);
  }

  static getDerivedStateFromProps(
    props: DeckGLPolygonProps,
    state?: DeckGLPolygonState,
  ) {
    const { width, height, formData, payload } = props;

    // the state is computed only from the payload; if it hasn't changed, do
    // not recompute state since this would reset selections and/or the play
    // slider position due to changes in form controls
    if (state && payload.form_data === state.formData) {
      return null;
    }

    const features = payload.data.features || [];

    let { viewport } = props;
    if (formData.autozoom) {
      viewport = fitViewport(viewport, {
        width,
        height,
        points: features.flatMap(getPointsFromPolygon),
      });
    }

    return {
      viewport,
      selected: [],
      lastClick: 0,
      formData: payload.form_data,
    };
  }

  onSelect(polygon: JsonObject) {
    const { formData, onAddFilter } = this.props;

    const now = new Date().getDate();
    const doubleClick = now - this.state.lastClick <= DOUBLE_CLICK_THRESHOLD;

    // toggle selected polygons
    const selected = [...this.state.selected];
    if (doubleClick) {
      selected.splice(0, selected.length, polygon);
    } else if (formData.toggle_polygons) {
      const i = selected.indexOf(polygon);
      if (i === -1) {
        selected.push(polygon);
      } else {
        selected.splice(i, 1);
      }
    } else {
      selected.splice(0, 1, polygon);
    }

    this.setState({ selected, lastClick: now });
    if (formData.table_filter) {
      onAddFilter(formData.line_column, selected, false, true);
    }
  }

  getLayers() {
    if (this.props.payload.data.features === undefined) {
      return [];
    }

    const layer = getLayer(
      this.props.formData,
      this.props.payload,
      this.props.onAddFilter,
      this.setTooltip,
      this.state.selected,
      this.onSelect,
    );

    return [layer];
  }

  setTooltip = (tooltip: TooltipProps['tooltip']) => {
    const { current } = this.containerRef;
    if (current) {
      current.setTooltip(tooltip);
    }
  };

  render() {
    const { payload, formData, setControlValue } = this.props;

    const fd = formData;
    const metricLabel = fd.metric ? fd.metric.label || fd.metric : null;
    const accessor = (d: JsonObject) => d[metricLabel];

    const buckets = getBuckets(formData, payload.data.features, accessor);

    return (
      <div style={{ position: 'relative' }}>
        <DeckGLContainerStyledWrapper
          ref={this.containerRef}
          viewport={this.state.viewport}
          layers={this.getLayers()}
          setControlValue={setControlValue}
          mapStyle={formData.mapbox_style}
          mapboxApiAccessToken={payload.data.mapboxApiKey}
          width={this.props.width}
          height={this.props.height}
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
  }
}

export default DeckGLPolygon;

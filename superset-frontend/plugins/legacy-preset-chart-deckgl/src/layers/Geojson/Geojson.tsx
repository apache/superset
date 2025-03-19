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
import { memo, useCallback, useMemo, useRef } from 'react';
import { GeoJsonLayer } from 'deck.gl/typed';
import geojsonExtent from '@mapbox/geojson-extent';
import {
  HandlerFunction,
  JsonObject,
  JsonValue,
  QueryFormData,
} from '@superset-ui/core';

import {
  DeckGLContainerHandle,
  DeckGLContainerStyledWrapper,
} from '../../DeckGLContainer';
import { hexToRGB } from '../../utils/colors';
import sandboxedEval from '../../utils/sandbox';
import { commonLayerProps } from '../common';
import TooltipRow from '../../TooltipRow';
import fitViewport, { Viewport } from '../../utils/fitViewport';
import { TooltipProps } from '../../components/Tooltip';

const propertyMap = {
  fillColor: 'fillColor',
  color: 'fillColor',
  fill: 'fillColor',
  'fill-color': 'fillColor',
  strokeColor: 'strokeColor',
  'stroke-color': 'strokeColor',
  'stroke-width': 'strokeWidth',
};

const alterProps = (props: JsonObject, propOverrides: JsonObject) => {
  const newProps: JsonObject = {};
  Object.keys(props).forEach(k => {
    if (k in propertyMap) {
      newProps[propertyMap[k]] = props[k];
    } else {
      newProps[k] = props[k];
    }
  });
  if (typeof props.fillColor === 'string') {
    newProps.fillColor = hexToRGB(props.fillColor);
  }
  if (typeof props.strokeColor === 'string') {
    newProps.strokeColor = hexToRGB(props.strokeColor);
  }

  return {
    ...newProps,
    ...propOverrides,
  };
};
let features: JsonObject[];
const recurseGeoJson = (
  node: JsonObject,
  propOverrides: JsonObject,
  extraProps?: JsonObject,
) => {
  if (node?.features) {
    node.features.forEach((obj: JsonObject) => {
      recurseGeoJson(obj, propOverrides, node.extraProps || extraProps);
    });
  }
  if (node?.geometry) {
    const newNode = {
      ...node,
      properties: alterProps(node.properties, propOverrides),
    } as JsonObject;
    if (!newNode.extraProps) {
      newNode.extraProps = extraProps;
    }
    features.push(newNode);
  }
};

function setTooltipContent(o: JsonObject) {
  return (
    o.object?.extraProps && (
      <div className="deckgl-tooltip">
        {Object.keys(o.object.extraProps).map((prop, index) => (
          <TooltipRow
            key={`prop-${index}`}
            label={`${prop}: `}
            value={`${o.object.extraProps?.[prop]}`}
          />
        ))}
      </div>
    )
  );
}

const getFillColor = (feature: JsonObject) => feature?.properties?.fillColor;
const getLineColor = (feature: JsonObject) => feature?.properties?.strokeColor;

export function getLayer(
  formData: QueryFormData,
  payload: JsonObject,
  onAddFilter: HandlerFunction,
  setTooltip: (tooltip: TooltipProps['tooltip']) => void,
) {
  const fd = formData;
  const fc = fd.fill_color_picker;
  const sc = fd.stroke_color_picker;
  const fillColor = [fc.r, fc.g, fc.b, 255 * fc.a];
  const strokeColor = [sc.r, sc.g, sc.b, 255 * sc.a];
  const propOverrides: JsonObject = {};
  if (fillColor[3] > 0) {
    propOverrides.fillColor = fillColor;
  }
  if (strokeColor[3] > 0) {
    propOverrides.strokeColor = strokeColor;
  }

  features = [];
  recurseGeoJson(payload.data, propOverrides);

  let jsFnMutator;
  if (fd.js_data_mutator) {
    // Applying user defined data mutator if defined
    jsFnMutator = sandboxedEval(fd.js_data_mutator);
    features = jsFnMutator(features);
  }

  return new GeoJsonLayer({
    id: `geojson-layer-${fd.slice_id}` as const,
    data: features,
    extruded: fd.extruded,
    filled: fd.filled,
    stroked: fd.stroked,
    getFillColor,
    getLineColor,
    getLineWidth: fd.line_width || 1,
    pointRadiusScale: fd.point_radius_scale,
    lineWidthUnits: fd.line_width_unit,
    ...commonLayerProps(fd, setTooltip, setTooltipContent),
  });
}

export type DeckGLGeoJsonProps = {
  formData: QueryFormData;
  payload: JsonObject;
  setControlValue: (control: string, value: JsonValue) => void;
  viewport: Viewport;
  onAddFilter: HandlerFunction;
  height: number;
  width: number;
};

const DeckGLGeoJson = (props: DeckGLGeoJsonProps) => {
  const containerRef = useRef<DeckGLContainerHandle>();
  const setTooltip = useCallback((tooltip: TooltipProps['tooltip']) => {
    const { current } = containerRef;
    if (current) {
      current.setTooltip(tooltip);
    }
  }, []);

  const { formData, payload, setControlValue, onAddFilter, height, width } =
    props;

  const viewport: Viewport = useMemo(() => {
    if (formData.autozoom) {
      const points =
        payload?.data?.features?.reduce?.(
          (acc: [number, number, number, number][], feature: any) => {
            const bounds = geojsonExtent(feature);
            if (bounds) {
              return [...acc, [bounds[0], bounds[1]], [bounds[2], bounds[3]]];
            }

            return acc;
          },
          [],
        ) || [];

      if (points.length) {
        return fitViewport(props.viewport, {
          width,
          height,
          points,
        });
      }
    }
    return props.viewport;
  }, [
    formData.autozoom,
    height,
    payload?.data?.features,
    props.viewport,
    width,
  ]);

  const layer = getLayer(formData, payload, onAddFilter, setTooltip);

  return (
    <DeckGLContainerStyledWrapper
      ref={containerRef}
      mapboxApiAccessToken={payload.data.mapboxApiKey}
      viewport={viewport}
      layers={[layer]}
      mapStyle={formData.mapbox_style}
      setControlValue={setControlValue}
      height={height}
      width={width}
    />
  );
};

export default memo(DeckGLGeoJson);

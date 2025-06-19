/* eslint-disable react/jsx-handler-names */
/* eslint-disable react/no-access-state-in-setstate */
/* eslint-disable camelcase */
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
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { isEqual } from 'lodash';
import {
  Datasource,
  HandlerFunction,
  JsonObject,
  JsonValue,
  QueryFormData,
  SupersetClient,
  usePrevious,
} from '@superset-ui/core';
import { Layer } from '@deck.gl/core';

import {
  DeckGLContainerHandle,
  DeckGLContainerStyledWrapper,
} from '../DeckGLContainer';
import { getExploreLongUrl } from '../utils/explore';
import layerGenerators from '../layers';
import fitViewport, { Viewport } from '../utils/fitViewport';
import { TooltipProps } from '../components/Tooltip';

import { getPoints as getPointsArc } from '../layers/Arc/Arc';
import { getPoints as getPointsPath } from '../layers/Path/Path';
import { getPoints as getPointsPolygon } from '../layers/Polygon/Polygon';
import { getPoints as getPointsGrid } from '../layers/Grid/Grid';
import { getPoints as getPointsScatter } from '../layers/Scatter/Scatter';
import { getPoints as getPointsContour } from '../layers/Contour/Contour';
import { getPoints as getPointsHeatmap } from '../layers/Heatmap/Heatmap';
import { getPoints as getPointsHex } from '../layers/Hex/Hex';
import { getPoints as getPointsGeojson } from '../layers/Geojson/Geojson';
import { getPoints as getPointsScreengrid } from '../layers/Screengrid/Screengrid';

export type DeckMultiProps = {
  formData: QueryFormData;
  payload: JsonObject;
  setControlValue: (control: string, value: JsonValue) => void;
  viewport: Viewport;
  onAddFilter: HandlerFunction;
  height: number;
  width: number;
  datasource: Datasource;
  onSelect: () => void;
};

const DeckMulti = (props: DeckMultiProps) => {
  const containerRef = useRef<DeckGLContainerHandle>();

  const getAdjustedViewport = useCallback(() => {
    let viewport = { ...props.viewport };
    const points = [
      ...getPointsPolygon(props.payload.data.features.deck_polygon || []),
      ...getPointsPath(props.payload.data.features.deck_path || []),
      ...getPointsGrid(props.payload.data.features.deck_grid || []),
      ...getPointsScatter(props.payload.data.features.deck_scatter || []),
      ...getPointsContour(props.payload.data.features.deck_contour || []),
      ...getPointsHeatmap(props.payload.data.features.deck_heatmap || []),
      ...getPointsHex(props.payload.data.features.deck_hex || []),
      ...getPointsArc(props.payload.data.features.deck_arc || []),
      ...getPointsGeojson(props.payload.data.features.deck_geojson || []),
      ...getPointsScreengrid(props.payload.data.features.deck_screengrid || []),
    ];

    if (props.formData) {
      viewport = fitViewport(viewport, {
        width: props.width,
        height: props.height,
        points,
      });
    }
    if (viewport.zoom < 0) {
      viewport.zoom = 0;
    }
    return viewport;
  }, [props]);

  const [viewport, setViewport] = useState<Viewport>(getAdjustedViewport());
  const [subSlicesLayers, setSubSlicesLayers] = useState<Record<number, Layer>>(
    {},
  );

  const setTooltip = useCallback((tooltip: TooltipProps['tooltip']) => {
    const { current } = containerRef;
    if (current) {
      current.setTooltip(tooltip);
    }
  }, []);

  const loadLayers = useCallback(
    (formData: QueryFormData, payload: JsonObject, viewport?: Viewport) => {
      setViewport(getAdjustedViewport());
      setSubSlicesLayers({});
      payload.data.slices.forEach(
        (subslice: { slice_id: number } & JsonObject, layerIndex: number) => {
          const layerFilterScope = formData.layer_filter_scope;

          let layerSpecificExtraFilters = [
            ...(subslice.form_data.extra_filters || []),
            ...(formData.extra_filters || []),
            ...(formData.extra_form_data?.filters || []),
          ];

          let layerSpecificAdhocFilters = [
            ...(formData.adhoc_filters || []),
            ...(subslice.formData?.adhoc_filters || []),
            ...(formData.extra_form_data?.adhoc_filters || []),
          ];

          if (layerFilterScope) {
            const originalExtraFormDataFilters =
              formData.extra_form_data?.filters || [];
            const originalExtraFormDataAdhocFilters =
              formData.extra_form_data?.adhoc_filters || [];

            const layerShouldReceiveFilters = Object.values(
              layerFilterScope,
            ).some((layerIndices: number[]) =>
              layerIndices.includes(layerIndex),
            );

            if (layerShouldReceiveFilters) {
              layerSpecificExtraFilters = [
                ...(subslice.form_data.extra_filters || []),
                ...(formData.extra_filters || []),
                ...originalExtraFormDataFilters,
              ];

              layerSpecificAdhocFilters = [
                ...(formData.adhoc_filters || []),
                ...(subslice.form_data.adhoc_filters || []),
                ...originalExtraFormDataAdhocFilters,
              ];
            } else {
              layerSpecificExtraFilters = [
                ...(subslice.form_data.extra_filters || []),
              ];

              layerSpecificAdhocFilters = [
                ...(subslice.form_data.adhoc_filters || []),
              ];
            }
          }

          const subsliceCopy = {
            ...subslice,
            form_data: {
              ...subslice.form_data,
              extra_filters: layerSpecificExtraFilters,
              adhoc_filters: layerSpecificAdhocFilters,
            },
          };

          const url = getExploreLongUrl(subsliceCopy.form_data, 'json');

          if (url) {
            SupersetClient.get({
              endpoint: url,
            })
              .then(({ json }) => {
                // @ts-ignore TODO(hainenber): define proper type for `form_data.viz_type` and call signature for functions in layerGenerators.
                const layer = layerGenerators[subsliceCopy.form_data.viz_type](
                  subsliceCopy.form_data,
                  json,
                  props.onAddFilter,
                  setTooltip,
                  props.datasource,
                  [],
                  props.onSelect,
                );
                setSubSlicesLayers(subSlicesLayers => ({
                  ...subSlicesLayers,
                  [subsliceCopy.slice_id]: layer,
                }));
              })
              .catch(() => {});
          }
        },
      );
    },
    [
      props.datasource,
      props.onAddFilter,
      props.onSelect,
      setTooltip,
      getAdjustedViewport,
    ],
  );

  const prevDeckSlices = usePrevious(props.formData.deck_slices);
  useEffect(() => {
    const { formData, payload } = props;
    const hasChanges = !isEqual(prevDeckSlices, formData.deck_slices);
    if (hasChanges) {
      loadLayers(formData, payload);
    }
  }, [loadLayers, prevDeckSlices, props]);

  const { payload, formData, setControlValue, height, width } = props;
  const layers = Object.values(subSlicesLayers);

  return (
    <DeckGLContainerStyledWrapper
      ref={containerRef}
      mapboxApiAccessToken={payload.data.mapboxApiKey}
      viewport={viewport}
      layers={layers}
      mapStyle={formData.mapbox_style}
      setControlValue={setControlValue}
      onViewportChange={setViewport}
      height={height}
      width={width}
    />
  );
};

export default memo(DeckMulti);

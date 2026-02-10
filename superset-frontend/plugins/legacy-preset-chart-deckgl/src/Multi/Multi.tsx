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
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { isEqual } from 'lodash';
import { createSelector } from '@reduxjs/toolkit';
import {
  AdhocFilter,
  ContextMenuFilters,
  DataMask,
  Datasource,
  ensureIsArray,
  ExtraFormData,
  FilterState,
  HandlerFunction,
  isDefined,
  JsonObject,
  JsonValue,
  QueryFormData,
  QueryObjectFilterClause,
  SupersetClient,
  usePrevious,
} from '@superset-ui/core';
import { styled } from '@apache-superset/core/ui';
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

type DataMaskState = Record<
  string,
  DataMask & {
    extraFormData?: ExtraFormData & { visible_deckgl_layers?: number[] };
  }
>;

export type DeckMultiProps = {
  formData: QueryFormData;
  payload: JsonObject;
  setControlValue: (control: string, value: JsonValue) => void;
  viewport: Viewport;
  onAddFilter: HandlerFunction;
  height: number;
  width: number;
  datasource: Datasource;
  setDataMask?: (dataMask: DataMask) => void;
  onContextMenu?: (
    clientX: number,
    clientY: number,
    filters?: ContextMenuFilters,
  ) => void;
  onSelect: () => void;
  filterState?: FilterState;
  emitCrossFilters?: boolean;
};

const MultiWrapper = styled.div<{ height: number; width: number }>`
  position: relative;
  height: ${({ height }) => height}px;
  width: ${({ width }) => width}px;
`;

const selectDataMask = createSelector(
  (state: { dataMask?: DataMaskState }) => state.dataMask,
  dataMask => dataMask || {},
);

const DeckMulti = (props: DeckMultiProps) => {
  const containerRef = useRef<DeckGLContainerHandle>();

  const dataMask = useSelector(selectDataMask);

  const layerVisibilityFilter = Object.values(dataMask).find(
    mask => mask?.extraFormData?.visible_deckgl_layers !== undefined,
  );

  const visibleDeckLayersFromRedux =
    layerVisibilityFilter?.extraFormData?.visible_deckgl_layers;

  const getAdjustedViewport = useCallback(() => {
    let viewport = { ...props.viewport };

    // Default to autozoom enabled for backward compatibility (undefined treated as true)
    if (props.formData.autozoom !== false) {
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
        ...getPointsScreengrid(
          props.payload.data.features.deck_screengrid || [],
        ),
      ];

      if (props.formData && points.length > 0) {
        viewport = fitViewport(viewport, {
          width: props.width,
          height: props.height,
          points,
        });
      }
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
  const [layerOrder, setLayerOrder] = useState<number[]>([]);

  const setTooltip = useCallback((tooltip: TooltipProps['tooltip']) => {
    const { current } = containerRef;
    if (current) {
      current.setTooltip(tooltip);
    }
  }, []);

  const getLayerIndex = useCallback(
    (sliceId: number, payloadIndex: number, deckSlices?: number[]): number =>
      deckSlices ? deckSlices.indexOf(sliceId) : payloadIndex,
    [],
  );

  const processLayerFilters = useCallback(
    (
      subslice: JsonObject,
      formData: QueryFormData,
      layerIndex: number,
    ): {
      extraFilters: (AdhocFilter | QueryObjectFilterClause)[];
      adhocFilters: AdhocFilter[];
    } => {
      const layerFilterScope = formData.layer_filter_scope;

      const extraFilters: (AdhocFilter | QueryObjectFilterClause)[] = [
        ...(subslice.form_data.extra_filters || []),
        ...(formData.extra_filters || []),
      ];

      const adhocFilters: AdhocFilter[] = [
        ...(subslice.form_data?.adhoc_filters || []),
      ];

      if (layerFilterScope) {
        const filterDataMapping = formData.filter_data_mapping || {};
        let shouldAddDashboardAdhocFilters = false;

        Object.entries(layerFilterScope).forEach(
          ([filterId, filterScope]: [string, number[]]) => {
            const shouldApplyFilter =
              ensureIsArray(filterScope).includes(layerIndex);

            if (shouldApplyFilter) {
              shouldAddDashboardAdhocFilters = true;
              const filtersFromThisFilter = filterDataMapping[filterId] || [];
              extraFilters.push(...filtersFromThisFilter);
            }
          },
        );

        if (shouldAddDashboardAdhocFilters) {
          const dashboardAdhocFilters = formData.adhoc_filters || [];
          adhocFilters.push(...dashboardAdhocFilters);
        }
      } else {
        const originalExtraFormDataFilters =
          formData.extra_form_data?.filters || [];
        extraFilters.push(...originalExtraFormDataFilters);

        const dashboardAdhocFilters = formData.adhoc_filters || [];
        adhocFilters.push(...dashboardAdhocFilters);
      }

      return { extraFilters, adhocFilters };
    },
    [],
  );

  const createLayerFromData = useCallback(
    (subslice: JsonObject, json: JsonObject): Layer =>
      // @ts-expect-error TODO(hainenber): define proper type for `form_data.viz_type` and call signature for functions in layerGenerators.
      layerGenerators[subslice.form_data.viz_type]({
        formData: subslice.form_data,
        payload: json,
        setTooltip,
        datasource: props.datasource,
        onSelect: props.onSelect,
      }),
    [props.onSelect, props.datasource, setTooltip],
  );

  const loadSingleLayer = useCallback(
    (
      subslice: JsonObject,
      formData: QueryFormData,
      payloadIndex: number,
    ): void => {
      const layerIndex = getLayerIndex(
        subslice.slice_id,
        payloadIndex,
        formData.deck_slices,
      );
      let extraFilters: (AdhocFilter | QueryObjectFilterClause)[] = [];
      let adhocFilters: AdhocFilter[] = [];
      const isExplore = (window.location.href || '').includes('explore');
      if (isExplore) {
        // in explore all the filters are in the adhoc_filters
        const adhocFiltersFromFormData = formData.adhoc_filters || [];
        const finalAdhocFilters = adhocFiltersFromFormData
          .map((filter: AdhocFilter & { layerFilterScope?: number[] }) => {
            if (!isDefined(filter?.layerFilterScope)) {
              return filter;
            }
            if (
              Array.isArray(filter.layerFilterScope) &&
              filter.layerFilterScope.length > 0
            ) {
              if (filter.layerFilterScope.includes(-1)) {
                return filter;
              }
              if (filter.layerFilterScope.includes(layerIndex)) {
                return filter;
              }
            }
            return undefined;
          })
          .filter(filter => isDefined(filter));
        adhocFilters = finalAdhocFilters as AdhocFilter[];
      } else {
        const {
          extraFilters: processLayerFiltersResultExtraFilters,
          adhocFilters: processLayerFiltersResultAdhocFilters,
        } = processLayerFilters(subslice, formData, layerIndex);
        extraFilters = processLayerFiltersResultExtraFilters;
        adhocFilters = processLayerFiltersResultAdhocFilters;
      }

      const subsliceCopy = {
        ...subslice,
        form_data: {
          ...subslice.form_data,
          extra_filters: extraFilters,
          adhoc_filters: adhocFilters,
          // Preserve dashboard context for embedded mode permissions
          ...(formData.dashboardId && { dashboardId: formData.dashboardId }),
        },
      } as any as JsonObject & { slice_id: number };

      const url = getExploreLongUrl(subsliceCopy.form_data, 'json');

      if (url) {
        SupersetClient.get({ endpoint: url })
          .then(({ json }) => {
            const layer = createLayerFromData(subsliceCopy, json);
            setSubSlicesLayers(subSlicesLayers => ({
              ...subSlicesLayers,
              [subsliceCopy.slice_id]: layer,
            }));
          })
          .catch(error => {
            throw new Error(
              `Error loading layer for slice ${subsliceCopy.slice_id}: ${error}`,
            );
          });
      }
    },
    [getLayerIndex, processLayerFilters, createLayerFromData],
  );

  const loadLayers = useCallback(
    (
      formData: QueryFormData,
      payload: JsonObject,
      visibleLayers?: number[],
    ): void => {
      setViewport(getAdjustedViewport());
      setSubSlicesLayers({});

      let visibleDeckLayers = visibleLayers;

      if (!visibleDeckLayers) {
        visibleDeckLayers = (
          formData.extra_form_data as ExtraFormData & {
            visible_deckgl_layers?: number[];
          }
        )?.visible_deckgl_layers;
      }

      const deckSlicesOrder = formData.deck_slices || [];

      payload.data.slices.forEach(
        (subslice: { slice_id: number } & JsonObject, payloadIndex: number) => {
          if (visibleDeckLayers && Array.isArray(visibleDeckLayers)) {
            if (!visibleDeckLayers.includes(subslice.slice_id)) {
              return;
            }
          }

          loadSingleLayer(subslice, formData, payloadIndex);
        },
      );

      const orderedSliceIds = deckSlicesOrder.filter((sliceId: number) => {
        const subslice = payload.data.slices.find(
          (s: { slice_id: number }) => s.slice_id === sliceId,
        );
        if (!subslice) return false;
        if (visibleDeckLayers && Array.isArray(visibleDeckLayers)) {
          return visibleDeckLayers.includes(sliceId);
        }
        return true;
      });

      setLayerOrder(orderedSliceIds);
    },
    [getAdjustedViewport, loadSingleLayer],
  );

  const prevDeckSlices = usePrevious(props.formData.deck_slices);
  const prevVisibleLayersRedux = usePrevious(visibleDeckLayersFromRedux);

  useEffect(() => {
    const { formData, payload } = props;

    const deckSlicesChanged = !isEqual(prevDeckSlices, formData.deck_slices);
    const visibilityFilterChanged = !isEqual(
      prevVisibleLayersRedux,
      visibleDeckLayersFromRedux,
    );

    if (deckSlicesChanged || visibilityFilterChanged) {
      loadLayers(formData, payload, undefined);
    }
  }, [
    loadLayers,
    prevDeckSlices,
    prevVisibleLayersRedux,
    visibleDeckLayersFromRedux,
    props,
  ]);

  const { payload, formData, setControlValue, height, width } = props;

  const layers = useMemo(
    () =>
      layerOrder
        .map(sliceId => subSlicesLayers[sliceId])
        .filter(layer => layer !== undefined),
    [layerOrder, subSlicesLayers],
  );

  return (
    <MultiWrapper height={height} width={width}>
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
    </MultiWrapper>
  );
};

export default memo(DeckMulti);

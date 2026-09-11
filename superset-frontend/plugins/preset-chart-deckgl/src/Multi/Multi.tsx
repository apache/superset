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
import { isEqual } from 'lodash-es';
import { createSelector } from '@reduxjs/toolkit';
import {
  AdhocFilter,
  ChartProps,
  ContextMenuFilters,
  DataMask,
  Datasource,
  ensureIsArray,
  ExtraFormData,
  FilterState,
  getChartBuildQueryRegistry,
  getChartTransformPropsRegistry,
  getClientErrorObject,
  HandlerFunction,
  isDefined,
  JsonObject,
  JsonValue,
  QueryFormData,
  QueryObjectFilterClause,
  SupersetClient,
  getMapProviderMapStyle,
  usePrevious,
} from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import { styled, useTheme } from '@apache-superset/core/theme';
import { Alert } from '@apache-superset/core/components';
import { Layer } from '@deck.gl/core';

import {
  DeckGLContainerHandle,
  DeckGLContainerStyledWrapper,
} from '../DeckGLContainer';
import { addColorToFeatures } from '../utils/addColor';
import { COLOR_SCHEME_TYPES, ColorSchemeType } from '../utilities/utils';
import layerGenerators from '../layers';
import fitViewport, { Viewport } from '../utils/fitViewport';
import { getMapboxApiKey, getDeckMultiMaxSlices } from '../utils/mapbox';
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
  // deck_multi's buildQuery always returns an empty queries array (every
  // layer self-fetches instead), so this is always undefined in practice --
  // kept optional rather than dropped to match the shared transformProps
  // shape used across the deck.gl chart family.
  payload?: JsonObject;
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

// Default color_scheme_type per color-aware layer type, matching each control
// panel. Sub-slices arrive as raw saved form data without control-default
// hydration, so charts saved before this control existed need the default
// resolved here to keep their configured colors.
const COLOR_AWARE_LAYER_DEFAULTS: Record<string, ColorSchemeType> = {
  deck_scatter: COLOR_SCHEME_TYPES.categorical_palette,
  deck_path: COLOR_SCHEME_TYPES.fixed_color,
  deck_arc: COLOR_SCHEME_TYPES.fixed_color,
};

// Collect every layer's lat/lng points from a features map keyed by viz_type,
// so the viewport can be fitted to the combined data. In the v1 path the
// features are not pre-merged into one payload, so they are accumulated per
// layer as each one is fetched and passed here in the same shape.
const collectPoints = (features: JsonObject) => [
  ...getPointsPolygon(features.deck_polygon || []),
  ...getPointsPath(features.deck_path || []),
  ...getPointsGrid(features.deck_grid || []),
  ...getPointsScatter(features.deck_scatter || []),
  ...getPointsContour(features.deck_contour || []),
  ...getPointsHeatmap(features.deck_heatmap || []),
  ...getPointsHex(features.deck_hex || []),
  ...getPointsArc(features.deck_arc || []),
  ...getPointsGeojson(features.deck_geojson || []),
  ...getPointsScreengrid(features.deck_screengrid || []),
];

const selectDataMask = createSelector(
  (state: { dataMask?: DataMaskState }) => state.dataMask,
  dataMask => dataMask || {},
);

const DeckMulti = (props: DeckMultiProps) => {
  const containerRef = useRef<DeckGLContainerHandle>();
  const theme = useTheme();

  const dataMask = useSelector(selectDataMask);

  const layerVisibilityFilter = Object.values(dataMask).find(
    mask => mask?.extraFormData?.visible_deckgl_layers !== undefined,
  );

  const visibleDeckLayersFromRedux =
    layerVisibilityFilter?.extraFormData?.visible_deckgl_layers;

  // The v1 path fetches every layer client-side (see loadSingleLayer below),
  // so there is never pre-merged feature data available at mount or at the
  // start of a reload -- only the base viewport, clamped to a non-negative
  // zoom. Autozoom itself happens incrementally as each layer's features
  // arrive (see the refit in loadSingleLayer).
  const getAdjustedViewport = useCallback(() => {
    const viewport = { ...props.viewport };
    if (viewport.zoom < 0) {
      viewport.zoom = 0;
    }
    return viewport;
  }, [props.viewport]);

  const [viewport, setViewport] = useState<Viewport>(getAdjustedViewport());
  const [subSlicesLayers, setSubSlicesLayers] = useState<Record<number, Layer>>(
    {},
  );
  const [layerOrder, setLayerOrder] = useState<number[]>([]);
  // Per-slice error messages for layers that failed to load, so the failure is
  // surfaced in the chart instead of only the browser console.
  const [layerErrors, setLayerErrors] = useState<Record<number, string>>({});
  // Accumulates each layer's fetched features (keyed by slice_id, so two
  // layers sharing a viz_type don't clobber one another) so autozoom can fit
  // the viewport to the combined data. In the v1 path the features are
  // fetched per layer rather than pre-merged into props.payload, so the initial
  // getAdjustedViewport has nothing to fit to and the viewport is recomputed
  // here as each layer arrives.
  const layerFeaturesRef = useRef<
    Record<number, { vizType: string; features: JsonObject[] }>
  >({});
  // Bumped at the start of every loadLayers call. Each in-flight layer fetch
  // captures the generation it was started under; if deck_slices (or the
  // layer-visibility filter) changes again before that fetch resolves, its
  // callback checks the ref and bails out instead of writing a stale layer
  // or stale accumulated features into the current (already-reset) state.
  const loadGenerationRef = useRef(0);
  // Bumped at the start of every metadata-fetch effect run (before
  // fetchSubslices resolves). If deck_slices or the visibility filter
  // changes again while an earlier fetch is still pending, the stale
  // fetch's callback sees a mismatch here and skips calling loadLayers, so
  // an older, slower-resolving fetch can never clobber a newer generation.
  const fetchGenerationRef = useRef(0);

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
    (subslice: JsonObject, json: JsonObject): Layer => {
      const { form_data: subsliceFormData } = subslice;
      const defaultColorSchemeType =
        COLOR_AWARE_LAYER_DEFAULTS[subsliceFormData.viz_type];
      let layerFormData = subsliceFormData;
      let payload = json;

      // Resolve per-feature colors as CategoricalDeckGLContainer does when
      // the layer renders standalone.
      if (defaultColorSchemeType) {
        layerFormData = {
          ...subsliceFormData,
          color_scheme_type:
            subsliceFormData.color_scheme_type ?? defaultColorSchemeType,
        };
        if (Array.isArray(json?.data?.features)) {
          payload = {
            ...json,
            data: {
              ...json.data,
              features: addColorToFeatures(json.data.features, layerFormData),
            },
          };
        }
      }

      return (
        // @ts-expect-error TODO(hainenber): define proper type for `form_data.viz_type` and call signature for functions in layerGenerators.
        layerGenerators[layerFormData.viz_type]({
          formData: layerFormData,
          payload,
          setTooltip,
          datasource: props.datasource,
          onSelect: props.onSelect,
        })
      );
    },
    [props.onSelect, props.datasource, setTooltip],
  );

  const loadSingleLayer = useCallback(
    (
      subslice: JsonObject,
      formData: QueryFormData,
      payloadIndex: number,
      generation: number,
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
          // Include parent multilayer chart ID for security checks
          ...(formData.slice_id && { parent_slice_id: formData.slice_id }),
        },
      } as any as JsonObject & { slice_id: number };

      const vizType = subsliceCopy.form_data.viz_type as string;
      Promise.all([
        getChartBuildQueryRegistry().get(vizType),
        getChartTransformPropsRegistry().get(vizType),
      ])
        .then(([layerBuildQuery, layerTransformProps]) => {
          if (
            typeof layerBuildQuery !== 'function' ||
            typeof layerTransformProps !== 'function'
          ) {
            throw new Error(`Unknown deck.gl layer type: ${vizType}`);
          }
          const queryContext = layerBuildQuery(
            subsliceCopy.form_data as QueryFormData,
          );
          return SupersetClient.post({
            endpoint: '/api/v1/chart/data',
            jsonPayload: {
              ...queryContext,
              result_format: 'json',
              // 'full' takes the async-query handoff under
              // GLOBAL_ASYNC_QUERIES, and this call never registers a
              // listener to follow that job, so a cold cache means the
              // layer just never renders. 'results' returns the same
              // data/colnames/coltypes this reads, skips the async path
              // entirely.
              result_type: 'results',
            },
          }).then(({ json }) => {
            // A newer loadLayers call (deck_slices or the visibility filter
            // changed again) has already reset state; this response belongs
            // to an abandoned generation and must not write into it.
            if (loadGenerationRef.current !== generation) {
              return;
            }
            const chartProps = new ChartProps({
              width: props.width,
              height: props.height,
              datasource: props.datasource as unknown as JsonObject,
              formData: subsliceCopy.form_data,
              queriesData: (json as JsonObject).result,
              theme,
              hooks: {},
              initialValues: {},
            });
            const layerProps = layerTransformProps(chartProps) as JsonObject;
            const layer = createLayerFromData(subsliceCopy, layerProps.payload);
            setSubSlicesLayers(subSlicesLayers => ({
              ...subSlicesLayers,
              [subsliceCopy.slice_id]: layer,
            }));

            // Refit the viewport to the data now that this layer's features are
            // known (unless autozoom is off). The initial getAdjustedViewport
            // could not do this because the v1 payload carries no features.
            const layerFeatures = (layerProps.payload as JsonObject | undefined)
              ?.data?.features;
            if (formData.autozoom !== false && Array.isArray(layerFeatures)) {
              layerFeaturesRef.current = {
                ...layerFeaturesRef.current,
                [subsliceCopy.slice_id]: { vizType, features: layerFeatures },
              };
              // Bucket the per-slice features back by viz_type -- concatenating
              // rather than overwriting -- so collectPoints fits the viewport to
              // every layer even when several layers share the same viz_type.
              const bucketedFeatures: JsonObject = {};
              Object.values(layerFeaturesRef.current).forEach(
                ({ vizType: bucketVizType, features }) => {
                  bucketedFeatures[bucketVizType] = [
                    ...((bucketedFeatures[bucketVizType] as JsonObject[]) ||
                      []),
                    ...features,
                  ];
                },
              );
              const points = collectPoints(bucketedFeatures);
              if (points.length > 0) {
                const fitted = fitViewport(
                  { ...props.viewport },
                  { width: props.width, height: props.height, points },
                );
                setViewport(fitted.zoom < 0 ? { ...fitted, zoom: 0 } : fitted);
              }
            }
          });
        })
        .catch(async error => {
          if (loadGenerationRef.current !== generation) {
            return;
          }
          // Surface the failure in the chart (e.g. a layer bound to a dataset
          // that is missing the columns it needs) rather than only throwing to
          // the console.
          const { message, error: errorText } =
            await getClientErrorObject(error);
          setLayerErrors(layerErrors => ({
            ...layerErrors,
            [subsliceCopy.slice_id]:
              message || errorText || 'Failed to load layer',
          }));
        });
    },
    [
      getLayerIndex,
      processLayerFilters,
      createLayerFromData,
      props.width,
      props.height,
      props.datasource,
      props.viewport,
      theme,
    ],
  );

  const loadLayers = useCallback(
    (
      formData: QueryFormData,
      slices: ({ slice_id: number } & JsonObject)[],
      visibleLayers?: number[],
    ): void => {
      loadGenerationRef.current += 1;
      const { current: generation } = loadGenerationRef;
      setViewport(getAdjustedViewport());
      setSubSlicesLayers({});
      setLayerErrors({});
      // Start a fresh feature accumulation for the incremental autozoom refit.
      layerFeaturesRef.current = {};

      let visibleDeckLayers = visibleLayers;

      if (!visibleDeckLayers) {
        visibleDeckLayers = (
          formData.extra_form_data as ExtraFormData & {
            visible_deckgl_layers?: number[];
          }
        )?.visible_deckgl_layers;
      }

      const deckSlicesOrder = formData.deck_slices || [];

      slices.forEach(
        (subslice: { slice_id: number } & JsonObject, payloadIndex: number) => {
          if (visibleDeckLayers && Array.isArray(visibleDeckLayers)) {
            if (!visibleDeckLayers.includes(subslice.slice_id)) {
              return;
            }
          }

          loadSingleLayer(subslice, formData, payloadIndex, generation);
        },
      );

      const orderedSliceIds = deckSlicesOrder.filter((sliceId: number) => {
        const subslice = slices.find(
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

  const toLayerFormData = useCallback(
    (
      sliceId: number,
      result: JsonObject,
    ): ({ slice_id: number } & JsonObject) | null => {
      let params: JsonObject = {};
      try {
        params = JSON.parse(result.params || '{}');
      } catch {
        params = {};
      }
      // The saved params carry a `datasource` string, but it can be
      // stale (e.g. example charts hardcode an id that differs from the
      // imported dataset's real id). Prefer the chart's authoritative
      // datasource_id/datasource_type so the layer queries the dataset
      // it is actually bound to, the same one it uses standalone.
      const datasource =
        result.datasource_id != null && result.datasource_type
          ? `${result.datasource_id}__${result.datasource_type}`
          : params.datasource;
      return {
        slice_id: sliceId,
        form_data: {
          ...params,
          datasource,
          slice_id: sliceId,
          viz_type: result.viz_type ?? params.viz_type,
        },
      };
    },
    [],
  );

  const fetchSubslicesPerChart = useCallback(
    (sliceIds: number[]) =>
      Promise.all<({ slice_id: number } & JsonObject) | null>(
        sliceIds.map(sliceId =>
          SupersetClient.get({ endpoint: `/api/v1/chart/${sliceId}` })
            .then(({ json }) =>
              toLayerFormData(sliceId, (json as JsonObject).result || {}),
            )
            .catch(() => null),
        ),
      ).then(slices =>
        slices.filter(
          (slice): slice is { slice_id: number } & JsonObject => slice !== null,
        ),
      ),
    [toLayerFormData],
  );

  const fetchSubslices = useCallback(
    (sliceIds: number[]) => {
      const containerId = props.formData.slice_id;
      if (!containerId) {
        // Unsaved chart in Explore: there is no saved container to gate
        // the bulk layer lookup on, so fall back to per-chart reads.
        return fetchSubslicesPerChart(sliceIds);
      }
      // Layer charts sit on no dashboard of their own, so a per-chart
      // GET /api/v1/chart/<id> can 404 for a principal (e.g. an embedded
      // guest) who is only entitled to the container. Resolving the
      // container's declared layers in one gated request reproduces the
      // access the legacy explore_json pipeline granted server-side.
      return SupersetClient.get({
        endpoint: `/api/v1/chart/${containerId}/deck_layers/`,
      })
        .then(({ json }) => {
          const layers = ((json as JsonObject).result || []) as JsonObject[];
          const resolved = layers
            .map(layer => toLayerFormData(layer.slice_id, layer))
            .filter(
              (slice): slice is { slice_id: number } & JsonObject =>
                slice !== null && sliceIds.includes(slice.slice_id),
            );
          // The container's persisted deck_slices can lag the in-memory
          // Explore selection (e.g. a layer just added but not yet saved),
          // so it won't be in the bulk response above. Fall back to
          // per-chart reads for whichever requested ids weren't resolved,
          // so newly selected layers still preview before saving.
          const resolvedIds = new Set(resolved.map(slice => slice.slice_id));
          const missingIds = sliceIds.filter(id => !resolvedIds.has(id));
          if (missingIds.length === 0) {
            return resolved;
          }
          return fetchSubslicesPerChart(missingIds).then(extra => [
            ...resolved,
            ...extra,
          ]);
        })
        .catch(() => fetchSubslicesPerChart(sliceIds));
    },
    [props.formData.slice_id, fetchSubslicesPerChart, toLayerFormData],
  );

  useEffect(() => {
    const { formData } = props;

    const deckSlicesChanged = !isEqual(prevDeckSlices, formData.deck_slices);
    const visibilityFilterChanged = !isEqual(
      prevVisibleLayersRedux,
      visibleDeckLayersFromRedux,
    );

    if (deckSlicesChanged || visibilityFilterChanged) {
      const sliceIds = ensureIsArray(formData.deck_slices) as number[];
      const maxSlices = getDeckMultiMaxSlices();
      if (sliceIds.length > maxSlices) {
        // Mirrors the cap the legacy viz.py pipeline enforced server-side:
        // refuse to fan out a metadata + data request per sub-slice beyond
        // the configured limit instead of stalling the dashboard/server.
        fetchGenerationRef.current += 1;
        setSubSlicesLayers({});
        setLayerOrder([]);
        setLayerErrors({
          [-1]: t(
            'Too many sub-slices requested. The maximum allowed is ' +
              '%(max)s, but %(count)s were requested.',
            { max: maxSlices, count: sliceIds.length },
          ),
        });
        return;
      }
      // deck_multi issues no query of its own (see buildQuery.ts), so each
      // sub-slice's saved form_data is always fetched client-side here --
      // there is no pre-merged payload to read subslice metadata from.
      fetchGenerationRef.current += 1;
      const { current: fetchGeneration } = fetchGenerationRef;
      fetchSubslices(sliceIds).then(slices => {
        // A newer deck_slices/visibility change already started its own
        // fetch; let that one (or whichever of them resolves) call
        // loadLayers instead of this abandoned, possibly slower one.
        if (fetchGenerationRef.current !== fetchGeneration) {
          return;
        }
        loadLayers(formData, slices, visibleDeckLayersFromRedux);
      });
    }
  }, [
    loadLayers,
    fetchSubslices,
    prevDeckSlices,
    prevVisibleLayersRedux,
    visibleDeckLayersFromRedux,
    props,
  ]);

  const { formData, setControlValue, height, width } = props;

  const layers = useMemo(
    () =>
      layerOrder
        .map(sliceId => subSlicesLayers[sliceId])
        .filter(layer => layer !== undefined),
    [layerOrder, subSlicesLayers],
  );
  const selectedMap = getMapProviderMapStyle({
    mapProvider: formData.map_renderer,
    maplibreStyle: formData.maplibre_style,
    mapboxStyle: formData.mapbox_style,
    legacyMapStyle: formData.map_style,
  });

  const errorMessages = Object.values(layerErrors);

  return (
    <MultiWrapper height={height} width={width}>
      {errorMessages.length > 0 && (
        <Alert
          type="warning"
          showIcon
          closable
          message={t('Some layers could not be loaded')}
          description={errorMessages.join(' ')}
          css={{
            position: 'absolute',
            top: theme.sizeUnit * 2,
            left: theme.sizeUnit * 2,
            right: theme.sizeUnit * 2,
            zIndex: 1,
          }}
        />
      )}
      <DeckGLContainerStyledWrapper
        ref={containerRef}
        viewport={viewport}
        layers={layers}
        mapStyle={selectedMap.mapStyle}
        mapProvider={selectedMap.mapProvider}
        mapboxApiKey={getMapboxApiKey()}
        setControlValue={setControlValue}
        onViewportChange={setViewport}
        height={height}
        width={width}
      />
    </MultiWrapper>
  );
};

export default memo(DeckMulti);

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
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { MapTileLifecycleTracker } from '@superset-ui/core/utils/mapRenderStatus';

import Point from 'ol/geom/Point';
import { View } from 'ol';
import BaseEvent from 'ol/events/Event';
import { unByKey } from 'ol/Observable';
import { toLonLat } from 'ol/proj';
import Source from 'ol/source/Source';
import { debounce } from 'lodash-es';
import { fitMapToCharts } from '../util/mapUtil';
import { ChartLayer } from './ChartLayer';
import { createLayer } from '../util/layerUtil';
import {
  ChartConfig,
  LayerConf,
  MapViewConfigs,
  OlChartMapProps,
} from '../types';
import { isChartConfigEqual } from '../util/chartUtil';

/** The name to reference the chart layer */
const CHART_LAYER_NAME = 'openlayers-chart-layer';

type LayerSourceState = {
  failedFeatureSources: ReadonlySet<Source>;
  failedTileSources: ReadonlySet<Source>;
  featureRecoverySources: ReadonlySet<Source>;
  pendingFeatureLoads: ReadonlyMap<Source, number>;
  pendingTileSources: ReadonlyMap<unknown, Source>;
  successfulTileSources: ReadonlySet<Source>;
};

const emptyLayerSourceState = (): LayerSourceState => ({
  failedFeatureSources: new Set(),
  failedTileSources: new Set(),
  featureRecoverySources: new Set(),
  pendingFeatureLoads: new Map(),
  pendingTileSources: new Map(),
  successfulTileSources: new Set(),
});

const advanceLayerSourceState = (
  state: LayerSourceState,
): LayerSourceState => ({
  failedFeatureSources: new Set(state.failedFeatureSources),
  failedTileSources: new Set(state.failedTileSources),
  featureRecoverySources: new Set(),
  pendingFeatureLoads: new Map(state.pendingFeatureLoads),
  pendingTileSources: new Map(state.pendingTileSources),
  successfulTileSources: new Set(),
});

const settleLayerSourceState = (state: LayerSourceState): LayerSourceState => ({
  ...state,
  failedFeatureSources: new Set([
    ...state.failedFeatureSources,
    ...state.pendingFeatureLoads.keys(),
  ]),
  failedTileSources: new Set([
    ...state.failedTileSources,
    ...state.pendingTileSources.values(),
  ]),
  featureRecoverySources: new Set(),
  pendingFeatureLoads: new Map(),
  pendingTileSources: new Map(),
});

export const OlChartMap = (props: OlChartMapProps) => {
  const {
    height,
    width,
    mapId,
    olMap,
    chartConfigs,
    chartSize,
    chartVizType,
    layerConfigs,
    mapView,
    chartBackgroundColor,
    chartBackgroundBorderRadius,
    setControlValue,
    theme,
  } = props;

  const locale = useSelector((state: any) => state?.common?.locale);

  const [currentChartConfigs, setCurrentChartConfigs] =
    useState<ChartConfig>(chartConfigs);
  const [currentMapView, setCurrentMapView] = useState<MapViewConfigs>(mapView);
  const [layersReady, setLayersReady] = useState(false);
  const [layerCreationFailed, setLayerCreationFailed] = useState(false);
  const [layerSourceState, setLayerSourceState] = useState<LayerSourceState>(
    emptyLayerSourceState,
  );
  const [mapRenderComplete, setMapRenderComplete] = useState(false);
  const mapRenderGenerationRef = useRef<object>({});
  const tileLifecycleRef = useRef(new MapTileLifecycleTracker());
  const advanceMapRender = useCallback(() => {
    const generation = {};
    mapRenderGenerationRef.current = generation;
    tileLifecycleRef.current.rebase(generation);
    setMapRenderComplete(false);
    setLayerSourceState(advanceLayerSourceState);
  }, []);

  useEffect(() => {
    const renderCompleteKey = olMap.on('rendercomplete', () => {
      tileLifecycleRef.current.reset(mapRenderGenerationRef.current);
      setLayerSourceState(settleLayerSourceState);
      setMapRenderComplete(true);
    });
    const moveStartKey = olMap.on('movestart', () => {
      setMapRenderComplete(false);
    });
    const moveEndKey = olMap.on('moveend', advanceMapRender);
    return () => {
      unByKey([renderCompleteKey, moveStartKey, moveEndKey]);
    };
  }, [advanceMapRender, olMap]);

  /**
   * Add map to correct DOM element.
   */
  useEffect(() => {
    setMapRenderComplete(false);
    olMap.setTarget(mapId);
    olMap.render();
  }, [olMap, mapId]);

  /**
   * Update map size if size of parent container changes.
   */
  useEffect(() => {
    advanceMapRender();
    olMap.updateSize();
    olMap.render();
  }, [advanceMapRender, olMap, width, height]);

  /**
   * The prop chartConfigs will always be created on the fly,
   * therefore the shallow comparison of the effect hooks will
   * always trigger. In this hook, we make a 'deep comparison'
   * between the incoming prop and the state. Only if the objects
   * differ will we set the state to the new object. All other
   * effect hooks that depend on chartConfigs should now depend
   * on currentChartConfigs instead.
   */
  useEffect(() => {
    setCurrentChartConfigs(oldCurrentChartConfigs => {
      if (isChartConfigEqual(chartConfigs, oldCurrentChartConfigs)) {
        return oldCurrentChartConfigs;
      }
      return chartConfigs;
    });
  }, [chartConfigs]);

  /**
   * The prop mapView will always be created on the fly,
   * therefore the shallow comparison of the effect hooks will
   * always trigger. In this hook, we compare only those props
   * that might be changed from outside of the component, i.e the
   * fixed properties and the mode. Only if these values differ will
   * we set the state to the new object. All other effect hooks that
   * depend on mapView should now depend on currentMapView instead.
   */
  useEffect(() => {
    setCurrentMapView(oldCurrentMapView => {
      const sameFixedZoom = oldCurrentMapView.fixedZoom === mapView.fixedZoom;
      const sameFixedLon =
        oldCurrentMapView.fixedLongitude === mapView.fixedLongitude;
      const sameFixedLat =
        oldCurrentMapView.fixedLatitude === mapView.fixedLatitude;
      const sameMode = oldCurrentMapView.mode === mapView.mode;
      if (sameFixedZoom && sameFixedLon && sameFixedLat && sameMode) {
        return oldCurrentMapView;
      }
      return mapView;
    });
  }, [mapView]);

  /**
   * Set initial map extent.
   */
  useEffect(() => {
    const view = olMap.getView();
    const { mode, fixedLatitude, fixedLongitude, fixedZoom } = mapView;

    switch (mode) {
      case 'CUSTOM': {
        const fixedCenter = new Point([fixedLongitude, fixedLatitude]);
        fixedCenter.transform('EPSG:4326', 'EPSG:3857'); // in-place

        view.setZoom(fixedZoom);
        view.setCenter(fixedCenter.getCoordinates());
        break;
      }
      default: {
        fitMapToCharts(olMap, chartConfigs);

        const zoom = view.getZoom();
        const centerCoord = view.getCenter();
        if (!centerCoord) return;

        const centerPoint = new Point(centerCoord);
        centerPoint.transform('EPSG:3857', 'EPSG:4326'); // in-place

        const [longitude, latitude] = centerPoint.getCoordinates();

        setControlValue('map_view', {
          ...mapView,
          zoom,
          longitude,
          latitude,
          fixedLatitude: latitude,
          fixedLongitude: longitude,
          fixedZoom: zoom,
        });

        break;
      }
    }
  }, []);

  /**
   * Update non-chart layers
   */
  useEffect(() => {
    let cancelled = false;
    const cleanupSourceListeners: (() => void)[] = [];
    setLayersReady(false);
    setLayerCreationFailed(false);
    setLayerSourceState(emptyLayerSourceState());
    const generation = {};
    mapRenderGenerationRef.current = generation;
    tileLifecycleRef.current.reset(generation);
    setMapRenderComplete(false);

    // clear existing layers
    // We first filter the layers we want to remove,
    // because removing items from an array during a loop can be erroneous.
    const layersToRemove = olMap
      .getLayers()
      .getArray()
      .filter(layer => !(layer instanceof ChartLayer));

    layersToRemove.forEach(layer => {
      olMap.removeLayer(layer);
    });

    const addLayers = async (configs: LayerConf[]) => {
      // Loop through layer configs, create layers and add them to map.
      // The first layer in the list will be the upmost layer on the map.
      // With insertAt(0) we ensure that the chart layer will always
      // stay on top, though.
      const createdLayersPromises = configs.map(createLayer);
      const createdLayers = await Promise.allSettled(createdLayersPromises);
      if (cancelled) {
        return;
      }
      let everyLayerCreated = true;
      createdLayers.forEach((createdLayer, idx) => {
        if (createdLayer.status === 'fulfilled' && createdLayer.value) {
          const source = createdLayer.value.getSource();
          if (source) {
            const invalidateMapRender = () => {
              if (!cancelled) setMapRenderComplete(false);
            };
            const getTile = (event: BaseEvent) =>
              (event as BaseEvent & { tile?: unknown }).tile;
            const onTileStart = (event: BaseEvent) => {
              if (cancelled) return;
              const tile = getTile(event);
              if (
                tile !== undefined &&
                tileLifecycleRef.current.startTile(
                  mapRenderGenerationRef.current,
                  tile,
                )
              ) {
                setLayerSourceState(current => ({
                  ...current,
                  pendingTileSources: new Map(current.pendingTileSources).set(
                    tile,
                    source,
                  ),
                }));
              }
              invalidateMapRender();
            };
            const recordTileOutcome = (
              event: BaseEvent,
              successful: boolean,
            ) => {
              if (cancelled) return;
              const tile = getTile(event);
              const provenance = tileLifecycleRef.current.completeTile(
                mapRenderGenerationRef.current,
                tile,
              );
              if (tile === undefined || provenance === null) {
                return;
              }
              setMapRenderComplete(false);
              setLayerSourceState(current => {
                const pendingTileSources = new Map(current.pendingTileSources);
                pendingTileSources.delete(tile);
                if (!successful) {
                  return {
                    ...current,
                    failedTileSources: new Set(current.failedTileSources).add(
                      source,
                    ),
                    pendingTileSources,
                  };
                }
                if (provenance === 'rebased') {
                  return { ...current, pendingTileSources };
                }
                return {
                  ...current,
                  pendingTileSources,
                  successfulTileSources: new Set(
                    current.successfulTileSources,
                  ).add(source),
                };
              });
            };
            const onTileError = (event: BaseEvent) =>
              recordTileOutcome(event, false);
            const onTileSuccess = (event: BaseEvent) =>
              recordTileOutcome(event, true);
            const onFeaturesStart = () => {
              if (cancelled) return;
              invalidateMapRender();
              setLayerSourceState(current => {
                const pendingFeatureLoads = new Map(
                  current.pendingFeatureLoads,
                );
                pendingFeatureLoads.set(
                  source,
                  (pendingFeatureLoads.get(source) ?? 0) + 1,
                );
                if (!current.failedFeatureSources.has(source)) {
                  return { ...current, pendingFeatureLoads };
                }
                return {
                  ...current,
                  featureRecoverySources: new Set(
                    current.featureRecoverySources,
                  ).add(source),
                  pendingFeatureLoads,
                };
              });
            };
            const onFeaturesError = () => {
              if (cancelled) return;
              invalidateMapRender();
              setLayerSourceState(current => {
                const pendingFeatureLoads = new Map(
                  current.pendingFeatureLoads,
                );
                const pendingCount = pendingFeatureLoads.get(source) ?? 0;
                if (pendingCount <= 1) {
                  pendingFeatureLoads.delete(source);
                } else {
                  pendingFeatureLoads.set(source, pendingCount - 1);
                }
                const featureRecoverySources = new Set(
                  current.featureRecoverySources,
                );
                featureRecoverySources.delete(source);
                return {
                  ...current,
                  failedFeatureSources: new Set(
                    current.failedFeatureSources,
                  ).add(source),
                  featureRecoverySources,
                  pendingFeatureLoads,
                };
              });
            };
            const onFeaturesSuccess = () => {
              if (cancelled) return;
              invalidateMapRender();
              setLayerSourceState(current => {
                const pendingFeatureLoads = new Map(
                  current.pendingFeatureLoads,
                );
                const pendingCount = pendingFeatureLoads.get(source) ?? 0;
                if (pendingCount === 0) {
                  return current;
                }
                if (pendingCount === 1) {
                  pendingFeatureLoads.delete(source);
                } else {
                  pendingFeatureLoads.set(source, pendingCount - 1);
                }
                if (
                  !current.featureRecoverySources.has(source) ||
                  pendingFeatureLoads.has(source)
                ) {
                  return { ...current, pendingFeatureLoads };
                }
                const failedFeatureSources = new Set(
                  current.failedFeatureSources,
                );
                failedFeatureSources.delete(source);
                const featureRecoverySources = new Set(
                  current.featureRecoverySources,
                );
                featureRecoverySources.delete(source);
                return {
                  ...current,
                  failedFeatureSources,
                  featureRecoverySources,
                  pendingFeatureLoads,
                };
              });
            };
            source.addEventListener('tileloadstart', onTileStart);
            source.addEventListener('featuresloadstart', onFeaturesStart);
            source.addEventListener('tileloaderror', onTileError);
            source.addEventListener('featuresloaderror', onFeaturesError);
            source.addEventListener('tileloadend', onTileSuccess);
            source.addEventListener('featuresloadend', onFeaturesSuccess);
            cleanupSourceListeners.push(() => {
              source.removeEventListener('tileloadstart', onTileStart);
              source.removeEventListener('featuresloadstart', onFeaturesStart);
              source.removeEventListener('tileloaderror', onTileError);
              source.removeEventListener('featuresloaderror', onFeaturesError);
              source.removeEventListener('tileloadend', onTileSuccess);
              source.removeEventListener('featuresloadend', onFeaturesSuccess);
            });
          }
          olMap.getLayers().insertAt(0, createdLayer.value);
        } else {
          everyLayerCreated = false;
          console.warn(`Layer could not be created: ${configs[idx]}`);
        }
      });
      setLayersReady(everyLayerCreated);
      setLayerCreationFailed(!everyLayerCreated);
      setMapRenderComplete(false);
      olMap.render();
    };

    addLayers(layerConfigs);
    return () => {
      cancelled = true;
      cleanupSourceListeners.forEach(cleanup => cleanup());
    };
  }, [olMap, layerConfigs]);

  /**
   * Create listener on map movement
   */
  useEffect(() => {
    const { fixedLatitude, fixedLongitude, fixedZoom } = currentMapView;

    const view = olMap.getView();

    const onViewChange = (event: BaseEvent) => {
      const targetView: View = event.target as unknown as View;

      const center = targetView.getCenter();
      const zoom = targetView.getZoom();
      if (!center) {
        return;
      }
      const [longitude, latitude] = toLonLat(center);

      setControlValue('map_view', {
        ...currentMapView,
        zoom,
        longitude,
        latitude,
        fixedLatitude,
        fixedLongitude,
        fixedZoom,
      });
    };

    // TODO: maybe replace with debounce from lodash
    // timeout=100ms seems to work well, 1000ms has other side-effects
    function debounce(func: Function, timeout = 100) {
      let timer: number;
      return function (this: any, ...args: any) {
        clearTimeout(timer);
        timer = window.setTimeout(() => func.apply(this, args), timeout);
      };
    }

    const debouncedOnViewChange = debounce((event: BaseEvent) => {
      onViewChange(event);
    });

    const listenerKey = view.on('change', debouncedOnViewChange);

    // this is executed before the next render,
    // here we cleanup the listener
    return () => {
      unByKey(listenerKey);
    };
  }, [olMap, setControlValue, currentMapView, currentChartConfigs]);

  useEffect(() => {
    if (currentMapView.mode === 'FIT_DATA') {
      const layers = olMap.getLayers();
      const chartLayer = layers
        .getArray()
        .find(layer => layer instanceof ChartLayer) as ChartLayer;

      if (!chartLayer) {
        return;
      }
      const extent = chartLayer.getExtent();
      if (!extent) {
        return;
      }
      const view = olMap.getView();
      view.fit(extent, {
        size: [250, 250],
      });
    }
  }, [olMap, currentMapView.mode]);

  /**
   * Send updated zoom to chart config control.
   */
  useEffect(() => {
    const view = olMap.getView();

    const onViewChange = (event: BaseEvent) => {
      const targetView: View = event.target as unknown as View;

      // ensure only zoom has changed
      const zoom = targetView.getZoom();

      // needed for TypeScript
      if (!zoom) return;

      // round zoom to full integer
      const previousZoom = Math.round(chartSize.configs.zoom);
      const newZoom = Math.round(zoom);

      // if zoom has not changed, we return and do not update the controls
      if (previousZoom === newZoom) return;

      const updatedChartSizeConf = {
        ...chartSize,
        configs: {
          ...chartSize.configs,
          zoom: newZoom,
        },
      };

      setControlValue('chart_size', updatedChartSizeConf);
    };

    const debouncedOnZoomChange = debounce((event: BaseEvent) => {
      onViewChange(event);
    }, 100);

    const listenerKey = view.on('change:resolution', debouncedOnZoomChange);

    // This is executed before the next render,
    // here we cleanup our listener.
    return () => {
      unByKey(listenerKey);
    };
  }, [olMap, setControlValue, chartSize]);

  /**
   * Handle changes that trigger changes of charts. Also instantiate
   * the chart layer, if it does not exist yet.
   */
  useEffect(() => {
    setMapRenderComplete(false);
    const layers = olMap.getLayers();
    const chartLayer = layers
      .getArray()
      .find(layer => layer instanceof ChartLayer) as ChartLayer;

    const { r, g, b, a } = chartBackgroundColor;
    const cssColor = `rgba(${r}, ${g}, ${b}, ${a})`;

    if (!chartLayer) {
      layers.forEach(layer => {
        if (!(layer instanceof ChartLayer)) {
          return;
        }
        // remove all chart elements from dom.
        layer.removeAllChartElements();
        // delete previous chart layers
        olMap.removeLayer(layer);
      });

      // prevent map interactions when mouse is over chart element
      // inspired by https://gis.stackexchange.com/questions/303331
      const deactivateInteractions = () => {
        olMap.getInteractions().forEach(interaction => {
          interaction.setActive(false);
        });
      };

      const activateInteractions = () => {
        olMap.getInteractions().forEach(interaction => {
          interaction.setActive(true);
        });
      };

      const newChartLayer = new ChartLayer({
        name: CHART_LAYER_NAME,
        chartConfigs: currentChartConfigs,
        chartVizType,
        chartSizeValues: chartSize.values,
        chartBackgroundCssColor: cssColor,
        chartBackgroundBorderRadius,
        onMouseOver: deactivateInteractions,
        onMouseOut: activateInteractions,
        theme,
        locale,
      });

      olMap.addLayer(newChartLayer);
    } else {
      let recreateCharts = false;
      if (chartVizType !== chartLayer.chartVizType) {
        chartLayer.setChartVizType(chartVizType, true);
        recreateCharts = true;
      }
      if (!isChartConfigEqual(currentChartConfigs, chartLayer.chartConfigs)) {
        chartLayer.setChartConfig(currentChartConfigs, true);
        recreateCharts = true;
      }
      // Only the last setter triggers rerendering of charts
      chartLayer.setChartBackgroundBorderRadius(
        chartBackgroundBorderRadius,
        true,
      );
      chartLayer.setChartBackgroundCssColor(cssColor, true);
      chartLayer.setChartSizeValues(chartSize.values, true);
      if (recreateCharts) {
        chartLayer.removeAllChartElements();
      }
      chartLayer.changed();
    }
    olMap.render();
  }, [
    olMap,
    theme,
    currentChartConfigs,
    chartVizType,
    chartSize.values,
    chartBackgroundColor,
    chartBackgroundBorderRadius,
    locale,
  ]);

  const unrecoveredTileSources = new Set([
    ...layerSourceState.failedTileSources,
    ...layerSourceState.pendingTileSources.values(),
  ]);
  layerSourceState.successfulTileSources.forEach(source =>
    unrecoveredTileSources.delete(source),
  );
  const hasUnrecoveredLayerFailure =
    unrecoveredTileSources.size > 0 ||
    layerSourceState.failedFeatureSources.size > 0 ||
    layerSourceState.pendingFeatureLoads.size > 0;
  const mapRenderFailed =
    layerCreationFailed || (mapRenderComplete && hasUnrecoveredLayerFailure);

  return (
    <div
      id={mapId}
      data-superset-map-status={
        mapRenderFailed
          ? 'error'
          : layersReady && mapRenderComplete
            ? 'rendered'
            : 'loading'
      }
      style={{
        height: `${height}px`,
        width: `${width}px`,
      }}
    />
  );
};

export default OlChartMap;

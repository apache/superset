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
import { useEffect, useState } from 'react';

import Point from 'ol/geom/Point';
import { View } from 'ol';
import BaseEvent from 'ol/events/Event';
import { unByKey } from 'ol/Observable';
import { toLonLat } from 'ol/proj';
import { debounce } from 'lodash';
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

  const [currentChartConfigs, setCurrentChartConfigs] =
    useState<ChartConfig>(chartConfigs);
  const [currentMapView, setCurrentMapView] = useState<MapViewConfigs>(mapView);

  /**
   * Add map to correct DOM element.
   */
  useEffect(() => {
    olMap.setTarget(mapId);
  }, [olMap, mapId]);

  /**
   * Update map size if size of parent container changes.
   */
  useEffect(() => {
    olMap.updateSize();
  }, [olMap, width, height]);

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
      createdLayers.forEach((createdLayer, idx) => {
        if (createdLayer.status === 'fulfilled' && createdLayer.value) {
          olMap.getLayers().insertAt(0, createdLayer.value);
        } else {
          console.warn(`Layer could not be created: ${configs[idx]}`);
        }
      });
    };

    addLayers(layerConfigs);
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
  }, [
    olMap,
    theme,
    currentChartConfigs,
    chartVizType,
    chartSize.values,
    chartBackgroundColor,
    chartBackgroundBorderRadius,
  ]);

  return (
    <div
      id={mapId}
      style={{
        height: `${height}px`,
        width: `${width}px`,
      }}
    />
  );
};

export default OlChartMap;

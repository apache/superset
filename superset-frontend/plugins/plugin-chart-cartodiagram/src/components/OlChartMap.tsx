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
import { useSelector } from 'react-redux';

import Point from 'ol/geom/Point';
import { View } from 'ol';
import BaseEvent from 'ol/events/Event';
import GeoJSON from 'ol/format/GeoJSON';
import { unByKey } from 'ol/Observable';
import { toLonLat, transformExtent } from 'ol/proj';
import { debounce } from 'lodash';
import { fitMapToData } from '../util/mapUtil';
import { ChartLayer } from './ChartLayer';
import { createLayer } from '../util/layerUtil';
import {
  ChartConfig,
  LayerConf,
  MapMaxExtentConfigs,
  MapViewConfigs,
  OlChartMapProps,
} from '../types';
import { isChartConfigEqual } from '../util/chartUtil';
import {
  getExtentFromFeatures,
  getMapExtentPadding,
} from '../util/geometryUtil';

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
    mapMaxExtent,
    mapExtentPadding,
    mapView,
    maxZoom,
    minZoom,
    chartBackgroundColor,
    chartBackgroundBorderRadius,
    setControlValue,
    theme,
  } = props;

  const locale = useSelector((state: any) => state?.common?.locale);

  const [currentChartConfigs, setCurrentChartConfigs] =
    useState<ChartConfig>(chartConfigs);
  const [currentMapView, setCurrentMapView] = useState<MapViewConfigs>(mapView);
  const [currentMapMaxExtent, setCurrentMapMaxExtent] =
    useState<MapMaxExtentConfigs>(mapMaxExtent);

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
   * The prop mapMaxExtent will always be created on the fly,
   * therefore the shallow comparison of the effect hooks will
   * always trigger. In this hook, we compare only those props
   * that might be changed from outside of the component, i.e the
   * fixed properties and the mode. Only if these values differ will
   * we set the state to the new object. All other effect hooks that
   * depend on mapView should now depend on currentMapMaxExtent instead.
   */
  useEffect(() => {
    setCurrentMapMaxExtent(oldCurrentMapExtentView => {
      const sameFixedMaxX =
        oldCurrentMapExtentView.fixedMaxX === mapMaxExtent.fixedMaxX;
      const sameFixedMaxY =
        oldCurrentMapExtentView.fixedMaxY === mapMaxExtent.fixedMaxY;
      const sameFixedMinX =
        oldCurrentMapExtentView.fixedMinX === mapMaxExtent.fixedMinX;
      const sameFixedMinY =
        oldCurrentMapExtentView.fixedMinY === mapMaxExtent.fixedMinY;
      const sameMode =
        oldCurrentMapExtentView.extentMode === mapMaxExtent.extentMode;
      if (
        sameFixedMaxX &&
        sameFixedMaxY &&
        sameFixedMinX &&
        sameFixedMinY &&
        sameMode
      ) {
        return oldCurrentMapExtentView;
      }
      return mapMaxExtent;
    });
  }, [mapMaxExtent]);

  /**
   * Set initial map extent.
   */
  useEffect(() => {
    const view = olMap.getView();
    const { mode, fixedLatitude, fixedLongitude, fixedZoom } = mapView;
    const { extentMode, fixedMaxX, fixedMaxY, fixedMinX, fixedMinY } =
      mapMaxExtent;

    switch (mode) {
      case 'CUSTOM': {
        const fixedCenter = new Point([fixedLongitude, fixedLatitude]);
        fixedCenter.transform('EPSG:4326', 'EPSG:3857'); // in-place

        view.setZoom(fixedZoom);
        view.setCenter(fixedCenter.getCoordinates());
        break;
      }
      default: {
        fitMapToData(
          olMap,
          chartConfigs,
          getMapExtentPadding(mapExtentPadding),
        );

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

    switch (extentMode) {
      case 'CUSTOM': {
        if (
          fixedMaxX === undefined ||
          fixedMaxY === undefined ||
          fixedMinX === undefined ||
          fixedMinY === undefined
        ) {
          break;
        }
        const [minx, miny, maxx, maxy] = transformExtent(
          [fixedMinX, fixedMinY, fixedMaxX, fixedMaxY],
          'EPSG:4326',
          'EPSG:3857',
        );

        olMap.setView(
          new View({
            center: view.getCenter(),
            zoom: view.getZoom(),
            extent: [minx, miny, maxx, maxy],
            maxZoom: view.getMaxZoom(),
            minZoom: view.getMinZoom(),
          }),
        );
        break;
      }
      default: {
        const newView = new View({
          center: view.getCenter(),
          zoom: view.getZoom(),
          maxZoom: view.getMaxZoom(),
          minZoom: view.getMinZoom(),
        });
        olMap.setView(newView);

        const [minx, miny, maxx, maxy] = newView.calculateExtent(
          olMap.getSize(),
        );

        const [minX, minY, maxX, maxY] = transformExtent(
          [minx, miny, maxx, maxy],
          'EPSG:3857',
          'EPSG:4326',
        );

        setControlValue('map_max_extent', {
          ...mapMaxExtent,
          minX,
          maxX,
          minY,
          maxY,
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
      const createdLayersPromises = configs.map(config => createLayer(config));
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

  useEffect(() => {
    const { extentMode, fixedMaxX, fixedMaxY, fixedMinX, fixedMinY } =
      currentMapMaxExtent;
    const view = olMap.getView();
    const center = view.getCenter();
    const zoom = view.getZoom();
    let extent;

    if (
      extentMode === 'CUSTOM' &&
      fixedMaxX !== undefined &&
      fixedMaxY !== undefined &&
      fixedMinX !== undefined &&
      fixedMinY !== undefined
    ) {
      extent = transformExtent(
        [fixedMinX, fixedMinY, fixedMaxX, fixedMaxY],
        'EPSG:4326',
        'EPSG:3857',
      );
    }

    olMap.setView(
      new View({
        center,
        zoom,
        extent,
        maxZoom: view.getMaxZoom(),
        minZoom: view.getMinZoom(),
      }),
    );
  }, [olMap, currentMapMaxExtent]);

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

      const [minx, miny, maxx, maxy] = targetView.calculateExtent(
        olMap.getSize(),
      );
      const [minX, minY, maxX, maxY] = transformExtent(
        [minx, miny, maxx, maxy],
        'EPSG:3857',
        'EPSG:4326',
      );

      if (center) {
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
      }

      setControlValue('map_max_extent', {
        ...currentMapMaxExtent,
        maxX,
        maxY,
        minX,
        minY,
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
  }, [
    olMap,
    setControlValue,
    currentMapView,
    currentChartConfigs,
    currentMapMaxExtent,
  ]);

  useEffect(() => {
    if (currentMapView.mode === 'FIT_DATA') {
      const layers = olMap.getLayers();
      const chartLayer = layers
        .getArray()
        .find(layer => layer instanceof ChartLayer) as ChartLayer;

      if (!chartLayer) {
        return;
      }

      const features = new GeoJSON().readFeatures(chartLayer.chartConfigs, {
        featureProjection: 'EPSG:4326',
      });

      const extent = getExtentFromFeatures(features);

      if (!extent) {
        return;
      }

      const transformedExtent = transformExtent(
        extent,
        'EPSG:4326',
        olMap.getView().getProjection(),
      );

      const view = olMap.getView();
      const padding = getMapExtentPadding(mapExtentPadding);

      view.fit(transformedExtent, { padding });
    }
  }, [olMap, currentMapView.mode, mapExtentPadding]);

  useEffect(() => {
    const view = olMap.getView();
    view.setMinZoom(minZoom);
  }, [minZoom, olMap]);

  useEffect(() => {
    const view = olMap.getView();
    view.setMaxZoom(maxZoom);
  }, [maxZoom, olMap]);

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

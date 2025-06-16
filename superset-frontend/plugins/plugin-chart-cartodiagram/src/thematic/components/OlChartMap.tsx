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
import { DataRecord } from '@superset-ui/core';
import React, { useEffect, useMemo, useState } from 'react';

import { Feature, FeatureCollection } from 'geojson';
import { debounce } from 'lodash';
import Point from 'ol/geom/Point';
import { View, Feature as OlFeature } from 'ol';
import BaseEvent from 'ol/events/Event';
import { unByKey } from 'ol/Observable';
import { toLonLat, transformExtent } from 'ol/proj';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import GeoJSON from 'ol/format/GeoJSON';
import {
  dataRecordsToOlFeatures,
  fitMapToData,
  fitMapToDataRecords,
} from '../../util/mapUtil';
import { createLayer } from '../../util/layerUtil';
import { LayerConf, MapViewConfigs } from '../../types';
import { MapMaxExtentConfigs, OlChartMapProps } from '../types';
import { isDataLayerConf } from '../../typeguards';
import { StyledFeatureTooltip } from './FeatureTooltip';
import { GeometryFormat } from '../constants';
import { Legend } from './Legend';
import { getMapExtentPadding } from '../../util/geometryUtil';

export const OlChartMap = (props: OlChartMapProps) => {
  const {
    height,
    width,
    mapId,
    data,
    geomFormat,
    geomColumn,
    olMap,
    layerConfigs,
    mapMaxExtent,
    mapView,
    maxZoom,
    minZoom,
    mapExtentPadding,
    setControlValue,
    timeColumn,
    timeFilter,
    tooltipTemplate,
    showLegend,
    showTooltip,
  } = props;

  const [currentMapView, setCurrentMapView] = useState<MapViewConfigs>(mapView);
  const [currentDataLayers, setCurrentDataLayers] =
    useState<VectorLayer<VectorSource>[]>();
  const [currentMapMaxExtent, setCurrentMapMaxExtent] =
    useState<MapMaxExtentConfigs>(mapMaxExtent);

  // The processed data, either list of data records or a feature collection,
  // depending on geomFormat. Use this throughout the component instead of data.
  const processedData: DataRecord[] | FeatureCollection = useMemo(() => {
    if (geomFormat === GeometryFormat.GEOJSON) {
      const features: Feature[] = [];
      data.forEach(item => {
        const { [geomColumn]: unparsedGeom, ...props } = item;
        const parsedGeom = JSON.parse(unparsedGeom as string);
        features.push({
          type: 'Feature',
          geometry: parsedGeom,
          properties: props,
        });
      });
      return {
        type: 'FeatureCollection',
        features,
      };
    }
    return data;
  }, [data, geomColumn, geomFormat]);

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
        if (
          geomFormat === GeometryFormat.WKB ||
          geomFormat === GeometryFormat.WKT
        ) {
          fitMapToDataRecords(
            olMap,
            processedData as DataRecord[],
            geomColumn,
            geomFormat,
            getMapExtentPadding(mapExtentPadding),
          );
        } else {
          fitMapToData(
            olMap,
            processedData as FeatureCollection,
            getMapExtentPadding(mapExtentPadding),
          );
        }

        const zoom = view.getZoom();
        const centerCoord = view.getCenter();
        if (!centerCoord) break;

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

  /* This useEffect hook runs whenever olMap, currentDataFeatureCollection,
   * mapExtentPadding or currentMapView.mode changes
   * If the currentMapView.mode is 'FIT_DATA', it adjusts the map (olMap) to fit
   * the current data
   */
  useEffect(() => {
    if (currentMapView.mode === 'FIT_DATA') {
      if (
        geomFormat === GeometryFormat.WKB ||
        geomFormat === GeometryFormat.WKT
      ) {
        fitMapToDataRecords(
          olMap,
          data,
          geomColumn,
          geomFormat,
          getMapExtentPadding(mapExtentPadding),
        );
      } else {
        fitMapToData(
          olMap,
          processedData as FeatureCollection,
          getMapExtentPadding(mapExtentPadding),
        );
      }
    }
  }, [
    olMap,
    data,
    currentMapView.mode,
    geomFormat,
    geomColumn,
    processedData,
    mapExtentPadding,
  ]);

  useEffect(() => {
    const view = olMap.getView();
    view.setMinZoom(minZoom);
  }, [minZoom, olMap]);

  useEffect(() => {
    const view = olMap.getView();
    view.setMaxZoom(maxZoom);
  }, [maxZoom, olMap]);

  const filteredData = useMemo(() => {
    if (!timeColumn || timeFilter === undefined) {
      return processedData;
    }
    let filteredRecords;
    if (
      geomFormat === GeometryFormat.WKB ||
      geomFormat === GeometryFormat.WKT
    ) {
      filteredRecords = (processedData as DataRecord[]).filter(
        f => f[timeColumn] === timeFilter,
      );
    } else {
      filteredRecords = {
        type: 'FeatureCollection',
        features: (processedData as FeatureCollection).features.filter(
          f => f.properties?.[timeColumn] === timeFilter,
        ),
      };
    }
    return filteredRecords;
  }, [processedData, timeColumn, timeFilter, geomFormat]);

  /**
   * Update layers
   */
  useEffect(() => {
    olMap.getLayers().clear();

    const addLayers = async (configs: LayerConf[]) => {
      // Loop through layer configs, create layers and add them to map.
      // The first layer in the list will be the upmost layer on the map.
      const createdLayersPromises = configs.map(config => createLayer(config));
      const createdLayers = await Promise.allSettled(createdLayersPromises);
      const createdDataLayers: VectorLayer<VectorSource>[] = [];
      createdLayers.forEach((createdLayer, idx) => {
        if (createdLayer.status === 'fulfilled' && createdLayer.value) {
          olMap.getLayers().insertAt(0, createdLayer.value);
          if (isDataLayerConf(configs[idx])) {
            createdDataLayers.push(
              createdLayer.value as VectorLayer<VectorSource>,
            );
          }
        } else {
          console.warn(`Layer could not be created: ${configs[idx]}`);
        }
      });
      setCurrentDataLayers(createdDataLayers);
    };

    const layerConfs = layerConfigs || [];
    addLayers(layerConfs);
  }, [olMap, layerConfigs]);

  /**
   * Update data layers
   */
  useEffect(() => {
    currentDataLayers?.forEach(dataLayer => {
      const source = dataLayer.getSource();
      let features: OlFeature[];
      if (
        geomFormat === GeometryFormat.WKB ||
        geomFormat === GeometryFormat.WKT
      ) {
        features = dataRecordsToOlFeatures(
          filteredData as DataRecord[],
          geomColumn,
          geomFormat,
        ) as OlFeature[];
      } else {
        features = new GeoJSON().readFeatures(filteredData, {
          featureProjection: 'EPSG:3857',
        });
      }
      source?.clear();
      source?.addFeatures(features);
    });
  }, [currentDataLayers, filteredData, geomColumn, geomFormat]);

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

    const listenerKey = view.on(
      'change',
      debounce((event: BaseEvent) => {
        onViewChange(event);
      }, 200),
    );

    // this is executed before the next render,
    // here we cleanup the listener
    return () => {
      unByKey(listenerKey);
    };
  }, [olMap, setControlValue, currentMapView, currentMapMaxExtent]);

  useEffect(() => {
    if (currentMapView.mode === 'FIT_DATA') {
      // Get first data layer to determine its extent.
      // A data layer is a vector layer without URL.
      const layers = olMap.getLayers();
      const dataLayer = layers.getArray().find(layer => {
        if (!(layer instanceof VectorLayer)) {
          return false;
        }
        const layerSource = layer.getSource();
        if (!(layerSource instanceof VectorSource)) {
          return false;
        }
        return !layerSource.getUrl();
      });

      if (!dataLayer) {
        return;
      }
      const extent = dataLayer.getExtent();

      if (!extent) {
        return;
      }
      const view = olMap.getView();
      const padding = getMapExtentPadding(mapExtentPadding);
      view.fit(extent, { padding });
    }
  }, [olMap, currentMapView.mode, mapExtentPadding]);

  return (
    <div
      id={mapId}
      style={{
        height: `${height}px`,
        width: `${width}px`,
      }}
    >
      <StyledFeatureTooltip
        olMap={olMap}
        dataLayers={currentDataLayers}
        tooltipTemplate={tooltipTemplate}
        showTooltip={showTooltip}
      />
      {showLegend && <Legend olMap={olMap} layerConfigs={layerConfigs} />}
    </div>
  );
};

export default OlChartMap;

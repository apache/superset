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
import { ChartProps, supersetTheme } from '@superset-ui/core';
import { LayerConf, MapViewConfigs } from '../src/types';
import transformProps from '../src/thematic/transformProps';
import { nonTimeSeriesChartData } from './testData';

describe('ThematicMapPlugin transformProps', () => {
  const layerConfigs: LayerConf[] = [
    {
      type: 'XYZ',
      title: 'foo',
      url: 'example.com',
    },
  ];
  const mapView: MapViewConfigs = {
    mode: 'FIT_DATA',
    zoom: 1,
    latitude: 0,
    longitude: 0,
    fixedZoom: 1,
    fixedLatitude: 0,
    fixedLongitude: 0,
  };

  const formData = {
    geomColumn: 'geom',
    geomFormat: 'geojson',
    columns: ['geom', 'foo', 'bar'],
    mapExtentPadding: 0,
    mapMaxExtent: {
      extentMode: 'NONE',
      maxX: 0,
      maxY: 0,
      minX: 0,
      minY: 0,
      fixedMaxX: undefined,
      fixedMaxY: undefined,
      fixedMinX: undefined,
      fixedMinY: undefined,
    },
    maxZoom: 0,
    minZoom: 0,
    layerConfigs,
    mapView,
    showLegend: true,
    showTimeslider: false,
    showTooltip: true,
  };

  const chartProps = new ChartProps({
    formData,
    width: 800,
    height: 600,
    queriesData: [
      {
        data: nonTimeSeriesChartData,
      },
    ],
    theme: supersetTheme,
  });

  it('should transform chart props for viz', () => {
    const transformedProps = transformProps(chartProps);
    expect(transformedProps).toEqual(
      expect.objectContaining({
        width: chartProps.width,
        height: chartProps.height,
        geomColumn: formData.geomColumn,
        columns: ['geom', 'foo', 'bar'],
        layerConfigs,
        mapView,
        data: nonTimeSeriesChartData,
        emitCrossFilters: false,
        filterState: {},
        geomFormat: formData.geomFormat,
        mapExtentPadding: formData.mapExtentPadding,
        mapMaxExtent: formData.mapMaxExtent,
        maxZoom: formData.maxZoom,
        minZoom: formData.minZoom,
        setControlValue: expect.any(Function),
        setDataMask: expect.any(Function),
        showLegend: formData.showLegend,
        showTimeslider: formData.showTimeslider,
        showTooltip: formData.showTooltip,
        theme: chartProps.theme,
      }),
    );
  });
});

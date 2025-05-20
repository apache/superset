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
    viz_type: 'thematic_map',
    geomColumn: 'geom',
    columns: ['geom', 'foo', 'bar'],
    layerConfigs,
    mapView,
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
        dataFeatureCollection: expect.objectContaining({
          type: 'FeatureCollection',
        }),
        layerConfigs,
        mapView,
      }),
    );
  });
});

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
import {
  ChartProps,
  getChartTransformPropsRegistry,
  supersetTheme,
} from '@superset-ui/core';
import { LayerConf, MapViewConfigs, ZoomConfigs } from '../../src/types';
import transformProps from '../../src/plugin/transformProps';
import {
  groupedTimeseriesChartData,
  groupedTimeseriesLabelMap,
} from '../testData';

describe('CartodiagramPlugin transformProps', () => {
  const chartSize: ZoomConfigs = {
    type: 'FIXED',
    configs: {
      height: 10,
      width: 10,
      zoom: 1,
    },
    values: {
      1: {
        height: 10,
        width: 10,
      },
    },
  };
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

  // only minimal subset of actual params
  const selectedChartParams = {
    groupby: ['bar'],
    x_axis: 'mydate',
  };

  const selectedChart = {
    id: 1,
    viz_type: 'pie',
    slice_name: 'foo',
    params: JSON.stringify(selectedChartParams),
  };

  const formData = {
    viz_type: 'cartodiagram',
    geomColumn: 'geom',
    selectedChart: JSON.stringify(selectedChart),
    chartSize,
    layerConfigs,
    mapView,
    chartBackgroundColor: '#000000',
    chartBackgroundBorderRadius: 5,
  };

  const chartProps = new ChartProps({
    formData,
    width: 800,
    height: 600,
    queriesData: [
      {
        data: groupedTimeseriesChartData,
        label_map: groupedTimeseriesLabelMap,
      },
    ],
    theme: supersetTheme,
  });

  let chartTransformPropsPieMock: jest.MockedFunction<any>;
  let chartTransformPropsTimeseriesMock: jest.MockedFunction<any>;
  beforeEach(() => {
    chartTransformPropsPieMock = jest.fn();
    chartTransformPropsTimeseriesMock = jest.fn();
    const registry = getChartTransformPropsRegistry();
    registry.registerValue('pie', chartTransformPropsPieMock);
    registry.registerValue(
      'echarts_timeseries',
      chartTransformPropsTimeseriesMock,
    );
  });

  afterEach(() => {
    // remove registered transformProps
    const registry = getChartTransformPropsRegistry();
    registry.clear();
  });

  it('should call the transform props function of the referenced chart', () => {
    transformProps(chartProps);
    expect(chartTransformPropsPieMock).toHaveBeenCalled();
    expect(chartTransformPropsTimeseriesMock).not.toHaveBeenCalled();
  });

  it('should transform chart props for viz', () => {
    const transformedProps = transformProps(chartProps);
    expect(transformedProps).toEqual(
      expect.objectContaining({
        width: chartProps.width,
        height: chartProps.height,
        geomColumn: formData.geomColumn,
        selectedChart: expect.objectContaining({
          viz_type: selectedChart.viz_type,
          params: selectedChartParams,
        }),
        // The actual test for the created chartConfigs
        // will be done in transformPropsUtil.test.ts
        chartConfigs: expect.objectContaining({
          type: 'FeatureCollection',
        }),
        chartVizType: selectedChart.viz_type,
        chartSize,
        layerConfigs,
        mapView,
        chartBackgroundColor: formData.chartBackgroundColor,
        chartBackgroundBorderRadius: formData.chartBackgroundBorderRadius,
      }),
    );
  });
});

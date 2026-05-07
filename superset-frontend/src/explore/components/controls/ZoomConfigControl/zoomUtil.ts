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

import { util } from 'echarts';
import { isZoomConfigsFixed, isZoomConfigsLinear } from './typeguards';
import {
  CreateDragGraphicOption,
  CreateDragGraphicOptions,
  GetDragGraphicPositionOptions,
  ZoomConfigs,
  ZoomConfigsFixed,
  ZoomConfigsLinear,
  ZoomConfigsExp,
} from './types';

/**
 * Compute the position for a drag graphic.
 *
 * @param param0 configuration
 * @param param0.chart The eChart instance.
 * @param param0.x The x value of the data item.
 * @param param0.y The y value of the data item.
 * @param param0.barWidth The width of the bar.
 * @param param0.add True, if barWidth should be added. False, if barWidth should be subtracted.
 * @returns
 */
export const getDragGraphicPosition = ({
  chart,
  x,
  y,
  barWidth,
  add,
}: GetDragGraphicPositionOptions) => {
  const valuePosition = chart.convertToPixel('grid', [x, y]);
  const xPos = Math.round(valuePosition[0]);
  let yPos = valuePosition[1] - barWidth / 2;
  if (add) {
    yPos = valuePosition[1] + barWidth / 2;
  }
  return [xPos, yPos];
};

/**
 * Create a single drag graphic with drag handler.
 * @param param0 configuration
 * @param param0.dataItem The data item to create the graphic for.
 * @param param0.dataItemIndex The index of the height/width value in the item.
 * @param param0.dataIndex The index of the dataItem in the data.
 * @param param0.onDrag Callback for dragging the bar.
 * @param param0.barWidth The width of the bar.
 * @param param0.chart The eChart instance.
 * @param param0.add True, if barWidth should be added for positioning. False, if barWidth should be subtracted.
 * @returns eChart Option for a drag graphic.
 */
export const createDragGraphicOption = ({
  dataItem,
  dataItemIndex,
  dataIndex,
  onDrag,
  barWidth,
  chart,
  add,
}: CreateDragGraphicOption) => {
  const position = getDragGraphicPosition({
    chart,
    x: dataItem[dataItemIndex],
    y: dataItem[2],
    barWidth,
    add,
  });
  return {
    type: 'circle',

    shape: {
      // The radius of the circle.
      r: barWidth / 4,
    },
    x: position[0],
    y: position[1],
    invisible: false,
    style: {
      // eslint-disable-next-line theme-colors/no-literal-colors
      fill: '#ffffff',
      // eslint-disable-next-line theme-colors/no-literal-colors
      stroke: '#aaa',
    },
    cursor: 'ew-resize',
    draggable: 'horizontal',
    // Give a big z value, which makes the circle cover the symbol
    // in bar series.
    z: 100,
    // Util method `util.curry` (from echarts) is used here to generate a
    // new function the same as `onDrag`, except that the
    // first parameter is fixed to be the `dataIndex` here.
    ondrag: util.curry(onDrag, dataIndex),
  };
};

/**
 * Create a drag graphic with dragHandler for each bar.
 *
 * @param param0 configuration
 * @param param0.data The eChart data.
 * @param param0.onWidthDrag Callback for dragging width bars.
 * @param param0.onHeightDrag Callback for dragging height bars.
 * @param param0.barWidth The width of a single bar.
 * @param param0.chart The eChart instance.
 * @returns List of eChart options for the drag graphics.
 */
export const createDragGraphicOptions = ({
  data,
  onWidthDrag,
  onHeightDrag,
  barWidth,
  chart,
}: CreateDragGraphicOptions) => {
  const graphics: any[] = [];
  data.forEach((dataItem: number[], dataIndex: number) => {
    const widthGraphic = createDragGraphicOption({
      dataItem,
      dataIndex,
      barWidth,
      chart,
      dataItemIndex: 0,
      onDrag: onWidthDrag,
      add: false,
    });
    graphics.push(widthGraphic);
    const heightGraphic = createDragGraphicOption({
      dataItem,
      dataIndex,
      barWidth,
      chart,
      dataItemIndex: 1,
      onDrag: onHeightDrag,
      add: true,
    });
    graphics.push(heightGraphic);
  });
  return graphics;
};

/**
 * Convert ZoomConfigs to eChart data.
 *
 * @param zoomConfigs The config to convert.
 * @returns eChart data representing the zoom configs.
 */
export const zoomConfigsToData = (zoomConfigs: ZoomConfigs['values']) =>
  Object.keys(zoomConfigs)
    .map((k: string) => parseInt(k, 10))
    .map((k: number) => [zoomConfigs[k].width, zoomConfigs[k].height, k]);

/**
 * Convert eChart data to ZoomConfigs.
 *
 * @param data The eChart data to convert.
 * @returns ZoomConfigs representing the eChart data.
 */
export const dataToZoomConfigs = (data: number[][]): ZoomConfigs['values'] =>
  data.reduce((prev: ZoomConfigs['values'], cur: number[]) => {
    // eslint-disable-next-line no-param-reassign
    prev[cur[2]] = { width: cur[0], height: cur[1] };
    return prev;
  }, {});

export const MAX_ZOOM_LEVEL = 28;
export const MIN_ZOOM_LEVEL = 0;

/**
 * Compute values for all zoom levels with fixed shape.
 *
 * @param zoomConfigsFixed The config to base the computation upon.
 * @returns The computed values for each zoom level.
 */
const computeFixedConfigValues = (zoomConfigsFixed: ZoomConfigsFixed) => {
  const values: ZoomConfigsFixed['values'] = {};

  for (let i = MIN_ZOOM_LEVEL; i <= MAX_ZOOM_LEVEL; i += 1) {
    const width = Math.round(zoomConfigsFixed.configs.width);
    const height = Math.round(zoomConfigsFixed.configs.height);
    values[i] = {
      width: width > 0 ? width : 0,
      height: height > 0 ? height : 0,
    };
  }

  return values;
};

/**
 * Compute values for all zoom levels with linear shape.
 *
 * @param zoomConfigsLinear The config to base the computation upon.
 * @returns The computed values for each zoom level.
 */
const computeLinearConfigValues = (zoomConfigsLinear: ZoomConfigsLinear) => {
  const values: ZoomConfigsLinear['values'] = {};
  for (let i = MIN_ZOOM_LEVEL; i <= MAX_ZOOM_LEVEL; i += 1) {
    const aspectRatio =
      zoomConfigsLinear.configs.height / zoomConfigsLinear.configs.width;
    const width = Math.round(
      zoomConfigsLinear.configs.width -
        (zoomConfigsLinear.configs.zoom - i) * zoomConfigsLinear.configs.slope,
    );
    const height = Math.round(aspectRatio * width);
    values[i] = {
      width: width > 0 ? width : 0,
      height: height > 0 ? height : 0,
    };
  }
  return values;
};

/**
 * Compute values for all zoom levels with exponential shape.
 *
 * @param zoomConfigsExp The config to base the computation upon.
 * @returns The computed values for each zoom level.
 */
const computeExpConfigValues = (zoomConfigsExp: ZoomConfigsExp) => {
  const values: ZoomConfigsExp['values'] = {};
  const x = Math.pow(
    zoomConfigsExp.configs.width,
    1 / zoomConfigsExp.configs.exponent,
  );
  for (let i = MIN_ZOOM_LEVEL; i <= MAX_ZOOM_LEVEL; i += 1) {
    const aspectRatio =
      zoomConfigsExp.configs.height / zoomConfigsExp.configs.width;
    const width = Math.round(
      Math.pow(
        x - (zoomConfigsExp.configs.zoom - i),
        zoomConfigsExp.configs.exponent,
      ),
    );
    const height = Math.round(aspectRatio * width);
    values[i] = {
      width: width > 0 ? width : 0,
      height: height > 0 ? height : 0,
    };
  }
  return values;
};

/**
 * Compute values for all zoom levels.
 *
 * @param zoomConfigs The config to base the computation upon.
 * @returns The computed values for each zoom level.
 */
export const computeConfigValues = (zoomConfigs: ZoomConfigs) => {
  if (isZoomConfigsFixed(zoomConfigs)) {
    return computeFixedConfigValues(zoomConfigs);
  }
  if (isZoomConfigsLinear(zoomConfigs)) {
    return computeLinearConfigValues(zoomConfigs);
  }
  return computeExpConfigValues(zoomConfigs);
};

/**
 * Convert ZoomConfigs to ZoomConfigsFixed.
 *
 * @param baseConfig The base config.
 * @returns The converted config.
 */
export const toFixedConfig = (
  baseConfig: ZoomConfigsFixed['configs'],
): ZoomConfigsFixed => {
  const zoomConfigFixed: ZoomConfigsFixed = {
    type: 'FIXED',
    configs: {
      zoom: baseConfig.zoom,
      width: baseConfig.width,
      height: baseConfig.height,
    },
    values: {},
  };

  zoomConfigFixed.values = computeFixedConfigValues(zoomConfigFixed);
  return zoomConfigFixed;
};

/**
 * Convert ZoomConfigs to ZoomConfigsLinear.
 *
 * @param baseConfig The base config.
 * @returns The converted config.
 */
export const toLinearConfig = (
  baseConfig: ZoomConfigsFixed['configs'],
): ZoomConfigsLinear => {
  const zoomConfigsLinear: ZoomConfigsLinear = {
    type: 'LINEAR',
    configs: {
      zoom: baseConfig.zoom,
      width: baseConfig.width,
      height: baseConfig.height,
      slope: baseConfig.slope,
    },
    values: {},
  } as ZoomConfigsLinear;

  zoomConfigsLinear.values = computeLinearConfigValues(zoomConfigsLinear);

  return zoomConfigsLinear;
};

/**
 * Convert ZoomConfigs to ZoomConfigsExp.
 *
 * @param baseConfig The base config.
 * @returns The converted config.
 */
export const toExpConfig = (
  baseConfig: ZoomConfigsExp['configs'],
): ZoomConfigsExp => {
  const zoomConfigExp: ZoomConfigsExp = {
    type: 'EXP',
    configs: {
      zoom: baseConfig.zoom,
      width: baseConfig.width,
      height: baseConfig.height,
      exponent: baseConfig.exponent,
    },
    values: {},
  } as ZoomConfigsExp;

  zoomConfigExp.values = computeExpConfigValues(zoomConfigExp);

  return zoomConfigExp;
};

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
import Layer from 'ol/layer/Layer';
import { FrameState } from 'ol/Map';
import { apply as applyTransform } from 'ol/transform';
import ReactDOM from 'react-dom';
import { SupersetTheme } from '@superset-ui/core';
import { ChartConfig, ChartLayerOptions, ChartSizeValues } from '../types';
import { createChartComponent } from '../util/chartUtil';
import { getProjectedCoordinateFromPointGeoJson } from '../util/geometryUtil';

import Loader from '../images/loading.gif';

/**
 * Custom OpenLayers layer that displays charts on given locations.
 */
export class ChartLayer extends Layer {
  charts: any[] = [];

  chartConfigs: ChartConfig = {
    type: 'FeatureCollection',
    features: [],
  };

  chartSizeValues: ChartSizeValues = {};

  chartVizType: string;

  div: HTMLDivElement;

  loadingMask: HTMLDivElement;

  chartBackgroundCssColor = '';

  chartBackgroundBorderRadius = 0;

  theme: SupersetTheme;

  /**
   * Create a ChartLayer.
   *
   * @param {ChartLayerOptions} options The options to create a ChartLayer
   * @param {ChartHtmlElement[]} options.charts An array with the chart objects containing the HTML element and the coordinate
   * @param {ChartConfig} options.chartConfigs The chart configuration for the charts
   * @param {ChartSizeValues} options.chartSizeValues The values for the chart sizes
   * @param {String} options.chartVizType The viztype of the charts
   * @param {String} options.chartBackgroundCssColor The color of the additionally added chart background
   * @param {Number} options.chartBackgroundBorderRadius The border radius in percent of the additionally added chart background
   * @param {Function} options.onMouseOver The handler function to execute when the mouse entering a HTML element
   * @param {Function} options.onMouseOut The handler function to execute when the mouse leaves a HTML element
   * @param {SupersetTheme} options.theme The superset theme
   */
  constructor(options: ChartLayerOptions) {
    super(options);

    this.chartVizType = options.chartVizType;

    if (options.chartConfigs) {
      this.chartConfigs = options.chartConfigs;
    }

    if (options.chartSizeValues) {
      this.chartSizeValues = options.chartSizeValues;
    }

    if (options.chartBackgroundCssColor) {
      this.chartBackgroundCssColor = options.chartBackgroundCssColor;
    }

    if (options.chartBackgroundBorderRadius) {
      this.chartBackgroundBorderRadius = options.chartBackgroundBorderRadius;
    }

    if (options.theme) {
      this.theme = options.theme;
    }

    const spinner = document.createElement('img');
    spinner.src = Loader;
    spinner.style.position = 'relative';
    spinner.style.width = '50px';
    spinner.style.top = '50%';
    spinner.style.left = '50%';
    spinner.style.transform = 'translate(-50%, -50%)';

    this.loadingMask = document.createElement('div');
    this.loadingMask.style.position = 'relative';
    this.loadingMask.style.height = '100%';
    this.loadingMask.appendChild(spinner);

    this.div = document.createElement('div');

    // TODO: consider creating an OpenLayers event
    if (options.onMouseOver) {
      this.div.onmouseover = options.onMouseOver;
    }

    // TODO: consider creating an OpenLayers event
    if (options.onMouseOut) {
      this.div.onmouseout = options.onMouseOut;
    }
  }

  setChartConfig(chartConfigs: ChartConfig, silent = false) {
    this.chartConfigs = chartConfigs;
    if (!silent) {
      this.changed();
    }
  }

  setChartVizType(chartVizType: string, silent = false) {
    this.chartVizType = chartVizType;
    if (!silent) {
      this.changed();
    }
  }

  setChartSizeValues(chartSizeValues: ChartSizeValues, silent = false) {
    this.chartSizeValues = chartSizeValues;
    if (!silent) {
      this.changed();
    }
  }

  setChartBackgroundCssColor(chartBackgroundCssColor: string, silent = false) {
    this.chartBackgroundCssColor = chartBackgroundCssColor;
    if (!silent) {
      this.changed();
    }
  }

  setChartBackgroundBorderRadius(
    chartBackgroundBorderRadius: number,
    silent = false,
  ) {
    this.chartBackgroundBorderRadius = chartBackgroundBorderRadius;
    if (!silent) {
      this.changed();
    }
  }

  /**
   * Unmount and remove all created chart elements from the DOM.
   */
  removeAllChartElements() {
    this.charts.forEach(chart => {
      ReactDOM.unmountComponentAtNode(chart.htmlElement);
      chart.htmlElement.remove();
    });
    this.charts = [];
  }

  createCharts(zoom: number) {
    const charts = this.chartConfigs.features.map(feature => {
      const container = document.createElement('div');

      let chartWidth = 0;
      let chartHeight = 0;
      if (this.chartSizeValues[zoom]) {
        chartWidth = this.chartSizeValues[zoom].width;
        chartHeight = this.chartSizeValues[zoom].height;
      }

      const chartComponent = createChartComponent(
        this.chartVizType,
        feature,
        chartWidth,
        chartHeight,
        this.theme,
      );
      ReactDOM.render(chartComponent, container);

      return {
        htmlElement: container,
        coordinate: getProjectedCoordinateFromPointGeoJson(feature.geometry),
        width: chartWidth,
        height: chartHeight,
        feature,
      };
    });

    this.charts = charts;
  }

  updateCharts(zoom: number) {
    const charts = this.charts.map(chart => {
      let chartWidth = 0;
      let chartHeight = 0;
      if (this.chartSizeValues[zoom]) {
        chartWidth = this.chartSizeValues[zoom].width;
        chartHeight = this.chartSizeValues[zoom].height;
      }

      // only rerender chart if size changes
      if (chartWidth === chart.width && chartHeight === chart.height) {
        return chart;
      }

      const chartComponent = createChartComponent(
        this.chartVizType,
        chart.feature,
        chartWidth,
        chartHeight,
        this.theme,
      );
      ReactDOM.render(chartComponent, chart.htmlElement);

      return {
        ...chart,
        width: chartWidth,
        height: chartHeight,
      };
    });

    this.charts = charts;
  }

  render(frameState: FrameState | null) {
    if (!frameState) {
      return this.div;
    }

    const { viewState } = frameState;
    const currentZoom = Math.round(viewState.zoom);

    // nextResolution is only defined while an animation
    // is in action. For this time we show a loading mask
    // to keep the amount of chart rerenderings as low as possible.
    if (viewState.nextResolution) {
      return this.loadingMask;
    }

    if (this.charts.length === 0) {
      this.createCharts(currentZoom);
    } else {
      this.updateCharts(currentZoom);
    }

    this.charts.forEach(chartObject => {
      const { htmlElement, coordinate, width, height } = chartObject;

      // clone, because applyTransform modifies in place
      const coordCopy = [...coordinate];

      const [x, y] = applyTransform(
        frameState.coordinateToPixelTransform,
        coordCopy,
      );

      // left and top are corrected to place the center of the chart to its location
      htmlElement.style.left = `${x - width / 2}px`;
      htmlElement.style.top = `${y - height / 2}px`;
      htmlElement.style.position = 'absolute';
      htmlElement.style['background-color' as any] =
        this.chartBackgroundCssColor;
      htmlElement.style['border-radius' as any] =
        `${this.chartBackgroundBorderRadius}%`;
    });

    // TODO should we always replace the html elements or is there a better way?
    const htmlElements = this.charts.map(c => c.htmlElement);
    this.div.replaceChildren(...htmlElements);

    return this.div;
  }
}

(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;}; /**
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
t,
ChartMetadata,
ChartPlugin,
AnnotationType,
Behavior } from
'@superset-ui/core';
import buildQuery from '../../buildQuery';
import controlPanel from '../controlPanel';
import transformProps from '../../transformProps';
import thumbnail from './images/thumbnail.png';
import {


EchartsTimeseriesSeriesType } from
'../../types';
import example1 from './images/SmoothLine1.png';

const smoothTransformProps = (chartProps) =>
transformProps({
  ...chartProps,
  formData: {
    ...chartProps.formData,
    seriesType: EchartsTimeseriesSeriesType.Smooth } });



export default class EchartsTimeseriesSmoothLineChartPlugin extends ChartPlugin


{
  constructor() {
    super({
      buildQuery,
      controlPanel,
      loadChart: () => import('../../EchartsTimeseries'),
      metadata: new ChartMetadata({
        behaviors: [Behavior.INTERACTIVE_CHART],
        category: t('Evolution'),
        credits: ['https://echarts.apache.org'],
        description: t(
        'Time-series Smooth-line is a variation of line chart. Without angles and hard edges, Smooth-line looks more smarter and more professional.'),

        exampleGallery: [{ url: example1 }],
        supportedAnnotationTypes: [
        AnnotationType.Event,
        AnnotationType.Formula,
        AnnotationType.Interval,
        AnnotationType.Timeseries],

        name: t('Time-series Smooth Line'),
        tags: [
        t('ECharts'),
        t('Predictive'),
        t('Advanced-Analytics'),
        t('Aesthetic'),
        t('Time'),
        t('Line'),
        t('Transformable')],

        thumbnail }),

      transformProps: smoothTransformProps });

  } // @ts-ignore
  __reactstandin__regenerateByEval(key, code) {// @ts-ignore
    this[key] = eval(code);}};(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(smoothTransformProps, "smoothTransformProps", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-echarts/src/Timeseries/Regular/SmoothLine/index.ts");reactHotLoader.register(EchartsTimeseriesSmoothLineChartPlugin, "EchartsTimeseriesSmoothLineChartPlugin", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-echarts/src/Timeseries/Regular/SmoothLine/index.ts");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();
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
import AsyncEsmComponent from 'src/components/AsyncEsmComponent';
import HiddenControl from './HiddenControl';
import withVerification from './withVerification';

const asyncComponent = (importer: Parameters<typeof AsyncEsmComponent>[0]) =>
  AsyncEsmComponent(importer, null);

const controlMap = {
  HiddenControl,
  AdhocFilterControl: asyncComponent(() => import('./AdhocFilterControl')),
  AnnotationLayerControl: asyncComponent(
    () => import('./AnnotationLayerControl'),
  ),
  BoundsControl: asyncComponent(() => import('./BoundsControl')),
  CheckboxControl: asyncComponent(() => import('./CheckboxControl')),
  CollectionControl: asyncComponent(() => import('./CollectionControl')),
  ColorMapControl: asyncComponent(() => import('./ColorMapControl')),
  ColorPickerControl: asyncComponent(() => import('./ColorPickerControl')),
  ColorSchemeControl: asyncComponent(() => import('./ColorSchemeControl')),
  DatasourceControl: asyncComponent(() => import('./DatasourceControl')),
  DateFilterControl: asyncComponent(() => import('./DateFilterControl')),
  FilterBoxItemControl: asyncComponent(() => import('./FilterBoxItemControl')),
  FixedOrMetricControl: asyncComponent(() => import('./FixedOrMetricControl')),
  SelectAsyncControl: asyncComponent(() => import('./SelectAsyncControl')),
  SelectControl: asyncComponent(() => import('./SelectControl')),
  SliderControl: asyncComponent(() => import('./SliderControl')),
  SpatialControl: asyncComponent(() => import('./SpatialControl')),
  TextAreaControl: asyncComponent(() => import('./TextAreaControl')),
  TextControl: asyncComponent(() => import('./TextControl')),
  TimeSeriesColumnControl: asyncComponent(
    () => import('./TimeSeriesColumnControl'),
  ),
  ViewportControl: asyncComponent(() => import('./ViewportControl')),
  VizTypeControl: asyncComponent(() => import('./VizTypeControl')),
  MetricsControl: asyncComponent(() => import('./MetricsControl')),
  SelectControlVerifiedOptions: asyncComponent(async () => {
    const { default: SelectControl } = await import('./SelectControl');
    return withVerification(SelectControl, 'column_name', 'options');
  }),
  MetricsControlVerifiedOptions: asyncComponent(async () => {
    const { default: MetricsControl } = await import('./MetricsControl');
    return withVerification(MetricsControl, 'metric_name', 'savedMetrics');
  }),
  AdhocFilterControlVerifiedOptions: asyncComponent(async () => {
    const { default: AdhocFilterControl } = await import(
      './AdhocFilterControl'
    );
    return withVerification(AdhocFilterControl, 'column_name', 'columns');
  }),
};

export default controlMap;

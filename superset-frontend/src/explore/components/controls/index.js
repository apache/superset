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
import AnnotationLayerControl from './AnnotationLayerControl';
import BoundsControl from './BoundsControl';
import CheckboxControl from './CheckboxControl';
import CollectionControl from './CollectionControl';
import ColorMapControl from './ColorMapControl';
import ColorPickerControl from './ColorPickerControl';
import ColorSchemeControl from './ColorSchemeControl';
import DatasourceControl from './DatasourceControl';
import DateFilterControl from './DateFilterControl';
import HiddenControl from './HiddenControl';
import SelectAsyncControl from './SelectAsyncControl';
import SelectControl from './SelectControl';
import SliderControl from './SliderControl';
import SpatialControl from './SpatialControl';
import TextControl from './TextControl';
import TimeSeriesColumnControl from './TimeSeriesColumnControl';
import ViewportControl from './ViewportControl';
import VizTypeControl from './VizTypeControl';
import FilterBoxItemControl from './FilterBoxItemControl';
import withVerification from './withVerification';

const controlMap = {
  AnnotationLayerControl,
  BoundsControl,
  CheckboxControl,
  CollectionControl,
  ColorMapControl,
  ColorPickerControl,
  ColorSchemeControl,
  DatasourceControl,
  DateFilterControl,
  FixedOrMetricControl: AsyncEsmComponent(() =>
    import('./FixedOrMetricControl'),
  ),
  HiddenControl,
  SelectAsyncControl,
  SelectControl,
  SliderControl,
  SpatialControl,
  TextAreaControl: AsyncEsmComponent(() => import('./TextAreaControl')),
  TextControl,
  TimeSeriesColumnControl,
  ViewportControl,
  VizTypeControl,
  MetricsControl: AsyncEsmComponent(() => import('./MetricsControl')),
  AdhocFilterControl: AsyncEsmComponent(() => import('./AdhocFilterControl')),
  FilterBoxItemControl,
  SelectControlVerifiedOptions: withVerification(
    SelectControl,
    'column_name',
    'options',
  ),
  MetricsControlVerifiedOptions: AsyncEsmComponent(() =>
    import('./MetricsControl').then(module => {
      return withVerification(module.default, 'metric_name', 'savedMetrics');
    }),
  ),
  AdhocFilterControlVerifiedOptions: AsyncEsmComponent(() =>
    import('./AdhocFilterControl').then(module => {
      return withVerification(module.default, 'column_name', 'columns');
    }),
  ),
};
export default controlMap;

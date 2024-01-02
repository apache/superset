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
import { sharedControlComponents } from '@superset-ui/chart-controls';
import AnnotationLayerControl from './AnnotationLayerControl';
import BoundsControl from './BoundsControl';
import CheckboxControl from './CheckboxControl';
import CollectionControl from './CollectionControl';
import ColorPickerControl from './ColorPickerControl';
import ColorSchemeControl from './ColorSchemeControl';
import DatasourceControl from './DatasourceControl';
import DateFilterControl from './DateFilterControl';
import FixedOrMetricControl from './FixedOrMetricControl';
import HiddenControl from './HiddenControl';
import SelectAsyncControl from './SelectAsyncControl';
import SelectControl from './SelectControl';
import SliderControl from './SliderControl';
import SpatialControl from './SpatialControl';
import TextAreaControl from './TextAreaControl';
import TextControl from './TextControl';
import TimeSeriesColumnControl from './TimeSeriesColumnControl';
import ViewportControl from './ViewportControl';
import VizTypeControl from './VizTypeControl';
import MetricsControl from './MetricControl/MetricsControl';
import AdhocFilterControl from './FilterControl/AdhocFilterControl';
import FilterBoxItemControl from './FilterBoxItemControl';
import ConditionalFormattingControl from './ConditionalFormattingControl';
import ContourControl from './ContourControl';
import DndColumnSelectControl, {
  DndColumnSelect,
  DndFilterSelect,
  DndMetricSelect,
} from './DndColumnSelectControl';
import XAxisSortControl from './XAxisSortControl';
import CurrencyControl from './CurrencyControl';
import ColumnConfigControl from './ColumnConfigControl';

const controlMap = {
  AnnotationLayerControl,
  BoundsControl,
  CheckboxControl,
  CollectionControl,
  ColorPickerControl,
  ColorSchemeControl,
  ColumnConfigControl,
  CurrencyControl,
  DatasourceControl,
  DateFilterControl,
  DndColumnSelectControl,
  DndColumnSelect,
  DndFilterSelect,
  DndMetricSelect,
  FixedOrMetricControl,
  HiddenControl,
  SelectAsyncControl,
  SelectControl,
  SliderControl,
  SpatialControl,
  TextAreaControl,
  TextControl,
  TimeSeriesColumnControl,
  ViewportControl,
  VizTypeControl,
  MetricsControl,
  AdhocFilterControl,
  FilterBoxItemControl,
  ConditionalFormattingControl,
  XAxisSortControl,
  ContourControl,
  ...sharedControlComponents,
};
export default controlMap;

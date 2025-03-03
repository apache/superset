// DODO was here
import { sharedControlComponents } from '@superset-ui/chart-controls';
import ConditionalFormattingControlDodo from 'src/DodoExtensions/explore/components/controls/ConditionalFormattingControlDodo'; // DODO added 45525377
import ConditionalFormattingControlNoGradient from 'src/DodoExtensions/explore/components/controls/ConditionalFormattingControlNoGradient'; // DODO added 45525377
import ConditionalFormattingMessageControl from 'src/DodoExtensions/explore/components/controls/ConditionalFormattingMessageControl'; // DODO added 45525377
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
import TimeOffsetControl from './TimeOffsetControl';
import ViewportControl from './ViewportControl';
import VizTypeControl from './VizTypeControl';
import MetricsControl from './MetricControl/MetricsControl';
import AdhocFilterControl from './FilterControl/AdhocFilterControl';
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
import { ComparisonRangeLabel } from './ComparisonRangeLabel';

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
  ConditionalFormattingControl,
  XAxisSortControl,
  ContourControl,
  ComparisonRangeLabel,
  TimeOffsetControl,
  ...sharedControlComponents,
  ConditionalFormattingControlDodo, // DODO added 45525377
  ConditionalFormattingControlNoGradient, // DODO added 45525377
  ConditionalFormattingMessageControl, // DODO added 45525377
};
export default controlMap;

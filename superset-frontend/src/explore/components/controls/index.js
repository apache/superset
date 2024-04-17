// DODO was here
import { sharedControlComponents } from '@superset-ui/chart-controls';
import ConditionalFormattingControlDodo from 'src/DodoExtensions/explore/components/controls/ConditionalFormattingControlDodo';
import ConditionalFormattingControlNoGradient from 'src/DodoExtensions/explore/components/controls/ConditionalFormattingControlNoGradient';
import ConditionalFormattingMessageControl from 'src/DodoExtensions/explore/components/controls/ConditionalFormattingMessageControl';
import TextAreaControlNoModal from 'src/DodoExtensions/explore/components/controls/TextAreaControlNoModal';
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
  ...sharedControlComponents,
  // DODO added start
  ConditionalFormattingControlDodo,
  ConditionalFormattingControlNoGradient,
  ConditionalFormattingMessageControl,
  TextAreaControlNoModal,
  // DODO added stop
};
export default controlMap;

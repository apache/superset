import {Binding, Color, Cursor, Stream, Vector2} from 'vega';
import {isObject} from 'vega-util';
import {SingleDefUnitChannel} from './channel';
import {FieldName, Value} from './channeldef';
import {DateTime} from './datetime';
import {Dict} from './util';

export const SELECTION_ID = '_vgsid_';
export type SelectionType = 'single' | 'multi' | 'interval';
export type SelectionResolution = 'global' | 'union' | 'intersect';

export type SelectionInit = Value | DateTime;
export type SelectionInitInterval = Vector2<boolean> | Vector2<number> | Vector2<string> | Vector2<DateTime>;

export type SelectionInitMapping = Dict<SelectionInit>;
export type SelectionInitIntervalMapping = Dict<SelectionInitInterval>;

export type LegendStreamBinding = {legend: string | Stream};
export type LegendBinding = 'legend' | LegendStreamBinding;

export interface BaseSelectionConfig {
  /**
   * Clears the selection, emptying it of all values. Can be a
   * [Event Stream](https://vega.github.io/vega/docs/event-streams/) or `false` to disable.
   *
   * __Default value:__ `dblclick`.
   *
   * __See also:__ [`clear`](https://vega.github.io/vega-lite/docs/clear.html) documentation.
   */
  clear?: Stream | string | boolean;

  /**
   * A [Vega event stream](https://vega.github.io/vega/docs/event-streams/) (object or selector) that triggers the selection.
   * For interval selections, the event stream must specify a [start and end](https://vega.github.io/vega/docs/event-streams/#between-filters).
   */
  on?: Stream | string;
  /**
   * With layered and multi-view displays, a strategy that determines how
   * selections' data queries are resolved when applied in a filter transform,
   * conditional encoding rule, or scale domain.
   *
   * __See also:__ [`resolve`](https://vega.github.io/vega-lite/docs/selection-resolve.html) documentation.
   */
  resolve?: SelectionResolution;

  // TODO(https://github.com/vega/vega-lite/issues/2596).
  // predicate?: string;
  // domain?: SelectionDomain;

  /**
   * An array of encoding channels. The corresponding data field values
   * must match for a data tuple to fall within the selection.
   *
   * __See also:__ [`encodings`](https://vega.github.io/vega-lite/docs/project.html) documentation.
   */
  encodings?: SingleDefUnitChannel[];

  /**
   * An array of field names whose values must match for a data tuple to
   * fall within the selection.
   *
   * __See also:__ [`fields`](https://vega.github.io/vega-lite/docs/project.html) documentation.
   */
  fields?: FieldName[];

  /**
   * By default, `all` data values are considered to lie within an empty selection.
   * When set to `none`, empty selections contain no data values.
   */
  empty?: 'all' | 'none';
}

export interface SingleSelectionConfig extends BaseSelectionConfig {
  /**
   * When set, a selection is populated by input elements (also known as dynamic query widgets)
   * or by interacting with the corresponding legend. Direct manipulation interaction is disabled by default;
   * to re-enable it, set the selection's [`on`](https://vega.github.io/vega-lite/docs/selection.html#common-selection-properties) property.
   *
   * Legend bindings are restricted to selections that only specify a single field or encoding.
   *
   * Query widget binding takes the form of Vega's [input element binding definition](https://vega.github.io/vega/docs/signals/#bind)
   * or can be a mapping between projected field/encodings and binding definitions.
   *
   * __See also:__ [`bind`](https://vega.github.io/vega-lite/docs/bind.html) documentation.
   */
  bind?: Binding | {[key: string]: Binding} | LegendBinding;

  /**
   * When true, an invisible voronoi diagram is computed to accelerate discrete
   * selection. The data value _nearest_ the mouse cursor is added to the selection.
   *
   * __See also:__ [`nearest`](https://vega.github.io/vega-lite/docs/nearest.html) documentation.
   */
  nearest?: boolean;

  /**
   * Initialize the selection with a mapping between [projected channels or field names](https://vega.github.io/vega-lite/docs/project.html) and initial values.
   *
   * __See also:__ [`init`](https://vega.github.io/vega-lite/docs/init.html) documentation.
   */
  init?: SelectionInitMapping;
}

export interface MultiSelectionConfig extends BaseSelectionConfig {
  /**
   * Controls whether data values should be toggled or only ever inserted into
   * multi selections. Can be `true`, `false` (for insertion only), or a
   * [Vega expression](https://vega.github.io/vega/docs/expressions/).
   *
   * __Default value:__ `true`, which corresponds to `event.shiftKey` (i.e.,
   * data values are toggled when a user interacts with the shift-key pressed).
   *
   * __See also:__ [`toggle`](https://vega.github.io/vega-lite/docs/toggle.html) documentation.
   */
  toggle?: string | boolean;

  /**
   * When true, an invisible voronoi diagram is computed to accelerate discrete
   * selection. The data value _nearest_ the mouse cursor is added to the selection.
   *
   * __See also:__ [`nearest`](https://vega.github.io/vega-lite/docs/nearest.html) documentation.
   */
  nearest?: boolean;

  /**
   * Initialize the selection with a mapping between [projected channels or field names](https://vega.github.io/vega-lite/docs/project.html) and an initial
   * value (or array of values).
   *
   * __See also:__ [`init`](https://vega.github.io/vega-lite/docs/init.html) documentation.
   */
  init?: SelectionInitMapping[];

  /**
   * When set, a selection is populated by interacting with the corresponding legend. Direct manipulation interaction is disabled by default;
   * to re-enable it, set the selection's [`on`](https://vega.github.io/vega-lite/docs/selection.html#common-selection-properties) property.
   *
   * Legend bindings are restricted to selections that only specify a single field or encoding.
   */
  bind?: LegendBinding;
}

// Similar to BaseMarkConfig but the field documentations are specificly for an interval mark.
export interface BrushConfig {
  /**
   * The fill color of the interval mark.
   *
   * __Default value:__ `"#333333"`
   *
   */
  fill?: Color;
  /**
   * The fill opacity of the interval mark (a value between `0` and `1`).
   *
   * __Default value:__ `0.125`
   */
  fillOpacity?: number;
  /**
   * The stroke color of the interval mark.
   *
   * __Default value:__ `"#ffffff"`
   */
  stroke?: Color;
  /**
   * The stroke opacity of the interval mark (a value between `0` and `1`).
   */
  strokeOpacity?: number;
  /**
   * The stroke width of the interval mark.
   */
  strokeWidth?: number;
  /**
   * An array of alternating stroke and space lengths, for creating dashed or dotted lines.
   */
  strokeDash?: number[];
  /**
   * The offset (in pixels) with which to begin drawing the stroke dash array.
   */
  strokeDashOffset?: number;
  /**
   * The mouse cursor used over the interval mark. Any valid [CSS cursor type](https://developer.mozilla.org/en-US/docs/Web/CSS/cursor#Values) can be used.
   */
  cursor?: Cursor;
}

export interface IntervalSelectionConfig extends BaseSelectionConfig {
  /**
   * When truthy, allows a user to interactively move an interval selection
   * back-and-forth. Can be `true`, `false` (to disable panning), or a
   * [Vega event stream definition](https://vega.github.io/vega/docs/event-streams/)
   * which must include a start and end event to trigger continuous panning.
   *
   * __Default value:__ `true`, which corresponds to
   * `[mousedown, window:mouseup] > window:mousemove!` which corresponds to
   * clicks and dragging within an interval selection to reposition it.
   *
   * __See also:__ [`translate`](https://vega.github.io/vega-lite/docs/translate.html) documentation.
   */
  translate?: string | boolean;

  /**
   * When truthy, allows a user to interactively resize an interval selection.
   * Can be `true`, `false` (to disable zooming), or a [Vega event stream
   * definition](https://vega.github.io/vega/docs/event-streams/). Currently,
   * only `wheel` events are supported.
   *
   * __Default value:__ `true`, which corresponds to `wheel!`.
   *
   * __See also:__ [`zoom`](https://vega.github.io/vega-lite/docs/zoom.html) documentation.
   */
  zoom?: string | boolean;

  /**
   * Establishes a two-way binding between the interval selection and the scales
   * used within the same view. This allows a user to interactively pan and
   * zoom the view.
   *
   * __See also:__ [`bind`](https://vega.github.io/vega-lite/docs/bind.html) documentation.
   */
  bind?: 'scales';

  /**
   * An interval selection also adds a rectangle mark to depict the
   * extents of the interval. The `mark` property can be used to customize the
   * appearance of the mark.
   *
   * __See also:__ [`mark`](https://vega.github.io/vega-lite/docs/selection-mark.html) documentation.
   */
  mark?: BrushConfig;

  /**
   * Initialize the selection with a mapping between [projected channels or field names](https://vega.github.io/vega-lite/docs/project.html) and arrays of
   * initial values.
   *
   * __See also:__ [`init`](https://vega.github.io/vega-lite/docs/init.html) documentation.
   */
  init?: SelectionInitIntervalMapping;
}

export interface BaseSelectionDef<T extends 'single' | 'multi' | 'interval'> {
  /**
   * Determines the default event processing and data query for the selection. Vega-Lite currently supports three selection types:
   *
   * - `"single"` -- to select a single discrete data value on `click`.
   * - `"multi"` -- to select multiple discrete data value; the first value is selected on `click` and additional values toggled on shift-`click`.
   * - `"interval"` -- to select a continuous range of data values on `drag`.
   */
  type: T;
}

export interface SingleSelection extends BaseSelectionDef<'single'>, SingleSelectionConfig {}

export interface MultiSelection extends BaseSelectionDef<'multi'>, MultiSelectionConfig {}

export interface IntervalSelection extends BaseSelectionDef<'interval'>, IntervalSelectionConfig {}

export type SelectionDef = SingleSelection | MultiSelection | IntervalSelection;

export type SelectionExtent =
  | {
      /**
       * The name of a selection.
       */
      selection: string;
      /**
       * The field name to extract selected values for, when a selection is [projected](https://vega.github.io/vega-lite/docs/project.html)
       * over multiple fields or encodings.
       */
      field?: FieldName;
    }
  | {
      /**
       * The name of a selection.
       */
      selection: string;
      /**
       * The encoding channel to extract selected values for, when a selection is [projected](https://vega.github.io/vega-lite/docs/project.html)
       * over multiple fields or encodings.
       */
      encoding?: SingleDefUnitChannel;
    };

export interface SelectionConfig {
  /**
   * The default definition for a [`single`](https://vega.github.io/vega-lite/docs/selection.html#type) selection. All properties and transformations
   *  for a single selection definition (except `type`) may be specified here.
   *
   * For instance, setting `single` to `{"on": "dblclick"}` populates single selections on double-click by default.
   */
  single?: SingleSelectionConfig;
  /**
   * The default definition for a [`multi`](https://vega.github.io/vega-lite/docs/selection.html#type) selection. All properties and transformations
   * for a multi selection definition (except `type`) may be specified here.
   *
   * For instance, setting `multi` to `{"toggle": "event.altKey"}` adds additional values to
   * multi selections when clicking with the alt-key pressed by default.
   */
  multi?: MultiSelectionConfig;
  /**
   * The default definition for an [`interval`](https://vega.github.io/vega-lite/docs/selection.html#type) selection. All properties and transformations
   * for an interval selection definition (except `type`) may be specified here.
   *
   * For instance, setting `interval` to `{"translate": false}` disables the ability to move
   * interval selections by default.
   */
  interval?: IntervalSelectionConfig;
}

export const defaultConfig: SelectionConfig = {
  single: {
    on: 'click',
    fields: [SELECTION_ID],
    resolve: 'global',
    empty: 'all',
    clear: 'dblclick'
  },
  multi: {
    on: 'click',
    fields: [SELECTION_ID],
    toggle: 'event.shiftKey',
    resolve: 'global',
    empty: 'all',
    clear: 'dblclick'
  },
  interval: {
    on: '[mousedown, window:mouseup] > window:mousemove!',
    encodings: ['x', 'y'],
    translate: '[mousedown, window:mouseup] > window:mousemove!',
    zoom: 'wheel!',
    mark: {fill: '#333', fillOpacity: 0.125, stroke: 'white'},
    resolve: 'global',
    clear: 'dblclick'
  }
};

export function isLegendBinding(bind: any): bind is LegendBinding {
  return !!bind && (bind === 'legend' || !!bind.legend);
}

export function isLegendStreamBinding(bind: any): bind is LegendStreamBinding {
  return isLegendBinding(bind) && isObject(bind);
}

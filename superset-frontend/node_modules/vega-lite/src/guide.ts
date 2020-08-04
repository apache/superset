import {ConditionValueDefMixins, ValueDef} from './channeldef';
import {LegendConfig} from './legend';
import {VgEncodeChannel} from './vega.schema';
import {Text} from 'vega';

export interface TitleMixins {
  /**
   * A title for the field. If `null`, the title will be removed.
   *
   * __Default value:__  derived from the field's name and transformation function (`aggregate`, `bin` and `timeUnit`). If the field has an aggregate function, the function is displayed as part of the title (e.g., `"Sum of Profit"`). If the field is binned or has a time unit applied, the applied function is shown in parentheses (e.g., `"Profit (binned)"`, `"Transaction Date (year-month)"`). Otherwise, the title is simply the field name.
   *
   * __Notes__:
   *
   * 1) You can customize the default field title format by providing the [`fieldTitle`](https://vega.github.io/vega-lite/docs/config.html#top-level-config) property in the [config](https://vega.github.io/vega-lite/docs/config.html) or [`fieldTitle` function via the `compile` function's options](https://vega.github.io/vega-lite/docs/compile.html#field-title).
   *
   * 2) If both field definition's `title` and axis, header, or legend `title` are defined, axis/header/legend title will be used.
   */
  title?: Text | null;
}

export interface FormatMixins {
  /**
   * The text formatting pattern for labels of guides (axes, legends, headers) and text marks.
   *
   * - If the format type is `"number"` (e.g., for quantitative fields), this is D3's [number format pattern](https://github.com/d3/d3-format#locale_format).
   * - If the format type is `"time"` (e.g., for temporal fields), this is D3's [time format pattern](https://github.com/d3/d3-time-format#locale_format).
   *
   * See the [format documentation](https://vega.github.io/vega-lite/docs/format.html) for more examples.
   *
   * __Default value:__  Derived from [numberFormat](https://vega.github.io/vega-lite/docs/config.html#format) config for number format and from [timeFormat](https://vega.github.io/vega-lite/docs/config.html#format) config for time format.
   */
  format?: string;

  /**
   * The format type for labels (`"number"` or `"time"`).
   *
   * __Default value:__
   * - `"time"` for temporal fields and ordinal and nomimal fields with `timeUnit`.
   * - `"number"` for quantitative fields as well as ordinal and nomimal fields without `timeUnit`.
   */
  formatType?: 'number' | 'time';

  /**
   * [Vega expression](https://vega.github.io/vega/docs/expressions/) for customizing labels text.
   *
   * __Note:__ The label text and value can be assessed via the `label` and `value` properties of the axis's backing `datum` object.
   */
  labelExpr?: string;
}

export interface Guide extends TitleMixins, FormatMixins {}

export interface VlOnlyGuideConfig {
  /**
   * Set to null to disable title for the axis, legend, or header.
   */
  title?: null;
}

export type GuideEncodingEntry = {[k in VgEncodeChannel]?: ValueDef & ConditionValueDefMixins};

export const VL_ONLY_LEGEND_CONFIG: (keyof LegendConfig)[] = [
  'gradientHorizontalMaxLength',
  'gradientHorizontalMinLength',
  'gradientVerticalMaxLength',
  'gradientVerticalMinLength',
  'unselectedOpacity'
];

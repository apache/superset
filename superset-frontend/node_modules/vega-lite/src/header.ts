import {Align, Color, FontStyle, FontWeight, Orient, TextBaseline, TitleAnchor, TitleConfig} from 'vega';
import {FormatMixins, Guide, VlOnlyGuideConfig} from './guide';
import {keys} from './util';

export const HEADER_TITLE_PROPERTIES_MAP: {[k in keyof CoreHeader]: keyof TitleConfig} = {
  titleAlign: 'align',
  titleAnchor: 'anchor',
  titleAngle: 'angle',
  titleBaseline: 'baseline',
  titleColor: 'color',
  titleFont: 'font',
  titleFontSize: 'fontSize',
  titleFontStyle: 'fontStyle',
  titleFontWeight: 'fontWeight',
  titleLimit: 'limit',
  titleLineHeight: 'lineHeight',
  titleOrient: 'orient',
  titlePadding: 'offset'
};

export const HEADER_LABEL_PROPERTIES_MAP: {[k in keyof CoreHeader]: keyof TitleConfig} = {
  labelAlign: 'align',
  labelAnchor: 'anchor',
  labelAngle: 'angle',
  labelColor: 'color',
  labelFont: 'font',
  labelFontSize: 'fontSize',
  labelFontStyle: 'fontStyle',
  labelLimit: 'limit',
  labelOrient: 'orient',
  labelPadding: 'offset'
};

export const HEADER_TITLE_PROPERTIES = keys(HEADER_TITLE_PROPERTIES_MAP);

export const HEADER_LABEL_PROPERTIES = keys(HEADER_LABEL_PROPERTIES_MAP);

export interface CoreHeader extends FormatMixins {
  // ---------- Title ----------
  /**
   * The anchor position for placing the title. One of `"start"`, `"middle"`, or `"end"`. For example, with an orientation of top these anchor positions map to a left-, center-, or right-aligned title.
   */
  titleAnchor?: TitleAnchor;

  /**
   * Horizontal text alignment (to the anchor) of header titles.
   */
  titleAlign?: Align;

  /**
   * The rotation angle of the header title.
   *
   * __Default value:__ `0`.
   *
   * @minimum -360
   * @maximum 360
   */
  titleAngle?: number;

  /**
   * Vertical text baseline for the header title. One of `"top"`, `"bottom"`, `"middle"`.
   *
   * __Default value:__ `"middle"`
   */
  titleBaseline?: TextBaseline;

  /**
   * Color of the header title, can be in hex color code or regular color name.
   */
  titleColor?: Color;

  /**
   * Font of the header title. (e.g., `"Helvetica Neue"`).
   */
  titleFont?: string;

  /**
   * Font size of the header title.
   *
   * @minimum 0
   */
  titleFontSize?: number;

  /**
   * The font style of the header title.
   */
  titleFontStyle?: FontStyle;

  /**
   * Font weight of the header title.
   * This can be either a string (e.g `"bold"`, `"normal"`) or a number (`100`, `200`, `300`, ..., `900` where `"normal"` = `400` and `"bold"` = `700`).
   */
  titleFontWeight?: FontWeight;

  /**
   * The maximum length of the header title in pixels. The text value will be automatically truncated if the rendered size exceeds the limit.
   *
   * __Default value:__ `0`, indicating no limit
   */
  titleLimit?: number;

  /**
   * Line height in pixels for multi-line title text.
   */
  titleLineHeight?: number;

  /**
   * The orientation of the header title. One of `"top"`, `"bottom"`, `"left"` or `"right"`.
   */
  titleOrient?: Orient;

  /**
   * The padding, in pixel, between facet header's title and the label.
   *
   * __Default value:__ `10`
   */
  titlePadding?: number;

  // ---------- Label ----------

  /**
   * A boolean flag indicating if labels should be included as part of the header.
   *
   * __Default value:__ `true`.
   */
  labels?: boolean;

  /**
   * Horizontal text alignment of header labels. One of `"left"`, `"center"`, or `"right"`.
   */
  labelAlign?: Align;

  /**
   * The anchor position for placing the labels. One of `"start"`, `"middle"`, or `"end"`. For example, with a label orientation of top these anchor positions map to a left-, center-, or right-aligned label.
   */
  labelAnchor?: TitleAnchor;

  /**
   * [Vega expression](https://vega.github.io/vega/docs/expressions/) for customizing labels.
   *
   * __Note:__ The label text and value can be assessed via the `label` and `value` properties of the header's backing `datum` object.
   */
  labelExpr?: string;

  /**
   * The rotation angle of the header labels.
   *
   * __Default value:__ `0` for column header, `-90` for row header.
   *
   * @minimum -360
   * @maximum 360
   */
  labelAngle?: number;

  /**
   * The color of the header label, can be in hex color code or regular color name.
   */
  labelColor?: Color;

  /**
   * The font of the header label.
   */
  labelFont?: string;

  /**
   * The font size of the header label, in pixels.
   *
   * @minimum 0
   */
  labelFontSize?: number;

  /**
   * The font style of the header label.
   */
  labelFontStyle?: FontStyle;

  /**
   * The maximum length of the header label in pixels. The text value will be automatically truncated if the rendered size exceeds the limit.
   *
   * __Default value:__ `0`, indicating no limit
   */
  labelLimit?: number;

  /**
   * The orientation of the header label. One of `"top"`, `"bottom"`, `"left"` or `"right"`.
   */
  labelOrient?: Orient;

  /**
   * The padding, in pixel, between facet header's label and the plot.
   *
   * __Default value:__ `10`
   */
  labelPadding?: number;
}

export interface HeaderConfig extends CoreHeader, VlOnlyGuideConfig {}

/**
 * Headers of row / column channels for faceted plots.
 */
export interface Header extends CoreHeader, Guide {}

export interface HeaderConfigMixins {
  /**
   * Header configuration, which determines default properties for all [headers](https://vega.github.io/vega-lite/docs/header.html).
   *
   * For a full list of header configuration options, please see the [corresponding section of in the header documentation](https://vega.github.io/vega-lite/docs/header.html#config).
   */
  header?: HeaderConfig;

  /**
   * Header configuration, which determines default properties for row [headers](https://vega.github.io/vega-lite/docs/header.html).
   *
   * For a full list of header configuration options, please see the [corresponding section of in the header documentation](https://vega.github.io/vega-lite/docs/header.html#config).
   */
  headerRow?: HeaderConfig;

  /**
   * Header configuration, which determines default properties for column [headers](https://vega.github.io/vega-lite/docs/header.html).
   *
   * For a full list of header configuration options, please see the [corresponding section of in the header documentation](https://vega.github.io/vega-lite/docs/header.html#config).
   */
  headerColumn?: HeaderConfig;

  /**
   * Header configuration, which determines default properties for non-row/column facet [headers](https://vega.github.io/vega-lite/docs/header.html).
   *
   * For a full list of header configuration options, please see the [corresponding section of in the header documentation](https://vega.github.io/vega-lite/docs/header.html#config).
   */
  headerFacet?: HeaderConfig;
}

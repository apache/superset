import { GroupEncodeEntry, GuideEncodeEntry, SignalRef, TextEncodeEntry } from '.';
import { Encode, Text } from './encode';
import {
  AlignValue,
  AnchorValue,
  BooleanValue,
  ColorValue,
  FontStyleValue,
  FontWeightValue,
  NumberValue,
  StringValue,
  TextBaselineValue,
} from './values';

export type TitleOrient = 'none' | 'left' | 'right' | 'top' | 'bottom';
export type TitleAnchor = null | 'start' | 'middle' | 'end';
export type TitleFrame = 'bounds' | 'group';

export interface Title extends BaseTitle {
  /**
   * The title text.
   */
  text: Text | SignalRef;

  /**
   * The subtitle text.
   */
  subtitle?: Text | SignalRef;

  /**
   * A mark name property to apply to the title text mark. (**Deprecated.**)
   */
  name?: string;

  /**
   * A boolean flag indicating if the title element should respond to input events such as mouse hover. (**Deprecated.**)
   */
  interactive?: boolean;

  /**
   * A mark style property to apply to the title text mark. If not specified, a default style of `"group-title"` is applied. (**Deprecated**)
   */
  style?: string | string[];

  /**
   * Mark definitions for custom title encoding.
   */
  encode?: TitleEncode | Encode<TextEncodeEntry>; // second entry is **deprecated**
}

export interface TitleEncode {
  /**
   * Custom encoding for the title container group.
   */
  group?: GuideEncodeEntry<GroupEncodeEntry>;
  /**
   * Custom encoding for the title text.
   */
  title?: GuideEncodeEntry<TextEncodeEntry>;
  /**
   * Custom encoding for the subtitle text.
   */
  subtitle?: GuideEncodeEntry<TextEncodeEntry>;
}

export interface BaseTitle {
  /**
   * The anchor position for placing the title and subtitle text. One of `"start"`, `"middle"`, or `"end"`. For example, with an orientation of top these anchor positions map to a left-, center-, or right-aligned title.
   */
  anchor?: AnchorValue;

  /**
   * The reference frame for the anchor position, one of `"bounds"` (to anchor relative to the full bounding box) or `"group"` (to anchor relative to the group width or height).
   */
  frame?: TitleFrame | StringValue;

  /**
   * The orthogonal offset in pixels by which to displace the title group from its position along the edge of the chart.
   */
  offset?: NumberValue;

  /**
   * Default title orientation (`"top"`, `"bottom"`, `"left"`, or `"right"`)
   */
  orient?: TitleOrient | SignalRef;

  // ---------- ARIA ----------
  /**
   * A boolean flag indicating if [ARIA attributes](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA) should be included (SVG output only).
   * If `false`, the "aria-hidden" attribute will be set on the output SVG group, removing the title from the ARIA accessibility tree.
   *
   * __Default value:__ `true`
   */
  aria?: boolean;

  // ---------- Shared Text Properties ----------
  /**
   * Horizontal text alignment for title text. One of `"left"`, `"center"`, or `"right"`.
   */
  align?: AlignValue;

  /**
   * Angle in degrees of title and subtitle text.
   */
  angle?: NumberValue;

  /**
   * Vertical text baseline for title and subtitle text. One of `"alphabetic"` (default), `"top"`, `"middle"`, `"bottom"`, `"line-top"`, or `"line-bottom"`. The `"line-top"` and `"line-bottom"` values operate similarly to `"top"` and `"bottom"`, but are calculated relative to the *lineHeight* rather than *fontSize* alone.
   */
  baseline?: TextBaselineValue;

  /**
   * Delta offset for title and subtitle text x-coordinate.
   */
  dx?: NumberValue;

  /**
   * Delta offset for title and subtitle text y-coordinate.
   */
  dy?: NumberValue;

  /**
   * The maximum allowed length in pixels of title and subtitle text.
   *
   * @minimum 0
   */
  limit?: NumberValue;

  // ---------- Title Text ----------
  /**
   * Text color for title text.
   */
  color?: ColorValue;

  /**
   * Font name for title text.
   */
  font?: StringValue;

  /**
   * Font size in pixels for title text.
   *
   * @minimum 0
   */
  fontSize?: NumberValue;

  /**
   * Font style for title text.
   */
  fontStyle?: FontStyleValue;

  /**
   * Font weight for title text.
   * This can be either a string (e.g `"bold"`, `"normal"`) or a number (`100`, `200`, `300`, ..., `900` where `"normal"` = `400` and `"bold"` = `700`).
   */
  fontWeight?: FontWeightValue;

  /**
   * Line height in pixels for multi-line title text or title text with `"line-top"` or `"line-bottom"` baseline.
   */
  lineHeight?: NumberValue;

  // ---------- Subtitle Text ----------
  /**
   * Text color for subtitle text.
   */
  subtitleColor?: ColorValue;

  /**
   * Font name for subtitle text.
   */
  subtitleFont?: StringValue;

  /**
   * Font size in pixels for subtitle text.
   *
   * @minimum 0
   */
  subtitleFontSize?: NumberValue;

  /**
   * Font style for subtitle text.
   */
  subtitleFontStyle?: FontStyleValue;

  /**
   * Font weight for subtitle text.
   * This can be either a string (e.g `"bold"`, `"normal"`) or a number (`100`, `200`, `300`, ..., `900` where `"normal"` = `400` and `"bold"` = `700`).
   */
  subtitleFontWeight?: FontWeightValue;

  /**
   * Line height in pixels for multi-line subtitle text.
   */
  subtitleLineHeight?: NumberValue;

  /**
   * The padding in pixels between title and subtitle text.
   */
  subtitlePadding?: NumberValue;

  /**
   * 	The integer z-index indicating the layering of the title group relative to other axis, mark, and legend groups.
   *
   * __Default value:__ `0`.
   *
   * @TJS-type integer
   * @minimum 0
   */
  zindex?: number;
}

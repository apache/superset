import {Color, Cursor, Text} from 'vega';
import {isArray, isNumber, isObject} from 'vega-util';
import {NormalizedSpec} from '.';
import {Config} from '../config';
import {Data} from '../data';
import {Resolve} from '../resolve';
import {TitleParams} from '../title';
import {Transform} from '../transform';
import {Flag, keys} from '../util';
import {BaseMarkConfig, LayoutAlign, RowCol} from '../vega.schema';
import {isConcatSpec} from './concat';
import {isFacetMapping, isFacetSpec} from './facet';
import {isRepeatSpec} from './repeat';

export {TopLevel} from './toplevel';

/**
 * Common properties for all types of specification
 */
export interface BaseSpec {
  /**
   * Title for the plot.
   */
  title?: Text | TitleParams;

  /**
   * Name of the visualization for later reference.
   */
  name?: string;

  /**
   * Description of this mark for commenting purpose.
   */
  description?: string;

  /**
   * An object describing the data source. Set to `null` to ignore the parent's data source. If no data is set, it is derived from the parent.
   */
  data?: Data | null;

  /**
   * An array of data transformations such as filter and new field calculation.
   */
  transform?: Transform[];
}

export interface DataMixins {
  /**
   * An object describing the data source.
   */
  data: Data;
}

export interface Step {
  /**
   * The size (width/height) per discrete step.
   */
  step: number;
}

export function isStep(size: number | Step | 'container' | 'merged'): size is Step {
  return isObject(size) && size['step'] !== undefined;
}

// TODO(https://github.com/vega/vega-lite/issues/2503): Make this generic so we can support some form of top-down sizing.
/**
 * Common properties for specifying width and height of unit and layer specifications.
 */
export interface LayoutSizeMixins {
  /**
   * The width of a visualization.
   *
   * - For a plot with a continuous x-field, width should be a number.
   * - For a plot with either a discrete x-field or no x-field, width can be either a number indicating a fixed width or an object in the form of `{step: number}` defining the width per discrete step. (No x-field is equivalent to having one discrete step.)
   * - To enable responsive sizing on width, it should be set to `"container"`.
   *
   * __Default value:__
   * Based on `config.view.continuousWidth` for a plot with a continuous x-field and `config.view.discreteWidth` otherwise.
   *
   * __Note:__ For plots with [`row` and `column` channels](https://vega.github.io/vega-lite/docs/encoding.html#facet), this represents the width of a single view and the `"container"` option cannot be used.
   *
   * __See also:__ [`width`](https://vega.github.io/vega-lite/docs/size.html) documentation.
   */
  width?: number | 'container' | Step;

  /**
   * The height of a visualization.
   *
   * - For a plot with a continuous y-field, height should be a number.
   * - For a plot with either a discrete y-field or no y-field, height can be either a number indicating a fixed height or an object in the form of `{step: number}` defining the height per discrete step. (No y-field is equivalent to having one discrete step.)
   * - To enable responsive sizing on height, it should be set to `"container"`.
   *
   * __Default value:__ Based on `config.view.continuousHeight` for a plot with a continuous y-field and `config.view.discreteHeight` otherwise.
   *
   * __Note:__ For plots with [`row` and `column` channels](https://vega.github.io/vega-lite/docs/encoding.html#facet), this represents the height of a single view and the `"container"` option cannot be used.
   *
   * __See also:__ [`height`](https://vega.github.io/vega-lite/docs/size.html) documentation.
   */
  height?: number | 'container' | Step;
}

export function isFrameMixins(o: any): o is FrameMixins {
  return o['view'] || o['width'] || o['height'];
}

export interface FrameMixins extends LayoutSizeMixins {
  /**
   * An object defining the view background's fill and stroke.
   *
   * __Default value:__ none (transparent)
   */
  view?: ViewBackground;
}

export interface ResolveMixins {
  /**
   * Scale, axis, and legend resolutions for view composition specifications.
   */
  resolve?: Resolve;
}

export interface BaseViewBackground
  extends Partial<
    Pick<
      BaseMarkConfig,
      | 'cornerRadius'
      | 'fillOpacity'
      | 'opacity'
      | 'strokeCap'
      | 'strokeDash'
      | 'strokeDashOffset'
      | 'strokeJoin'
      | 'strokeMiterLimit'
      | 'strokeOpacity'
      | 'strokeWidth'
    >
  > {
  // Override documentations for fill, stroke, and cursor
  /**
   * The fill color.
   *
   * __Default value:__ `undefined`
   */
  fill?: Color | null;

  /**
   * The stroke color.
   *
   * __Default value:__ `"#ddd"`
   */
  stroke?: Color | null;

  /**
   * The mouse cursor used over the view. Any valid [CSS cursor type](https://developer.mozilla.org/en-US/docs/Web/CSS/cursor#Values) can be used.
   */
  cursor?: Cursor;
}

export interface ViewBackground extends BaseViewBackground {
  /**
   * A string or array of strings indicating the name of custom styles to apply to the view background. A style is a named collection of mark property defaults defined within the [style configuration](https://vega.github.io/vega-lite/docs/mark.html#style-config). If style is an array, later styles will override earlier styles.
   *
   * __Default value:__ `"cell"`
   * __Note:__ Any specified view background properties will augment the default style.
   */
  style?: string | string[];
}

export interface BoundsMixins {
  /**
   * The bounds calculation method to use for determining the extent of a sub-plot. One of `full` (the default) or `flush`.
   *
   * - If set to `full`, the entire calculated bounds (including axes, title, and legend) will be used.
   * - If set to `flush`, only the specified width and height values for the sub-view will be used. The `flush` setting can be useful when attempting to place sub-plots without axes or legends into a uniform grid structure.
   *
   * __Default value:__ `"full"`
   */

  bounds?: 'full' | 'flush';
}

/**
 * Base layout for FacetSpec and RepeatSpec.
 * This is named "GenericComposition" layout as ConcatLayout is a GenericCompositionLayout too
 * (but _not_ vice versa).
 */
export interface GenericCompositionLayout extends BoundsMixins {
  /**
   * The alignment to apply to grid rows and columns.
   * The supported string values are `"all"`, `"each"`, and `"none"`.
   *
   * - For `"none"`, a flow layout will be used, in which adjacent subviews are simply placed one after the other.
   * - For `"each"`, subviews will be aligned into a clean grid structure, but each row or column may be of variable size.
   * - For `"all"`, subviews will be aligned and each row or column will be sized identically based on the maximum observed size. String values for this property will be applied to both grid rows and columns.
   *
   * Alternatively, an object value of the form `{"row": string, "column": string}` can be used to supply different alignments for rows and columns.
   *
   * __Default value:__ `"all"`.
   */
  align?: LayoutAlign | RowCol<LayoutAlign>;

  /**
   * Boolean flag indicating if subviews should be centered relative to their respective rows or columns.
   *
   * An object value of the form `{"row": boolean, "column": boolean}` can be used to supply different centering values for rows and columns.
   *
   * __Default value:__ `false`
   */
  center?: boolean | RowCol<boolean>;

  /**
   * The spacing in pixels between sub-views of the composition operator.
   * An object of the form `{"row": number, "column": number}` can be used to set
   * different spacing values for rows and columns.
   *
   * __Default value__: Depends on `"spacing"` property of [the view composition configuration](https://vega.github.io/vega-lite/docs/config.html#view-config) (`20` by default)
   */
  spacing?: number | RowCol<number>;
}

export const DEFAULT_SPACING = 20;

export interface ColumnMixins {
  /**
   * The number of columns to include in the view composition layout.
   *
   * __Default value__: `undefined` -- An infinite number of columns (a single row) will be assumed. This is equivalent to
   * `hconcat` (for `concat`) and to using the `column` channel (for `facet` and `repeat`).
   *
   * __Note__:
   *
   * 1) This property is only for:
   * - the general (wrappable) `concat` operator (not `hconcat`/`vconcat`)
   * - the `facet` and `repeat` operator with one field/repetition definition (without row/column nesting)
   *
   * 2) Setting the `columns` to `1` is equivalent to `vconcat` (for `concat`) and to using the `row` channel (for `facet` and `repeat`).
   */
  columns?: number;
}

export type GenericCompositionLayoutWithColumns = GenericCompositionLayout & ColumnMixins;

export type CompositionConfig = ColumnMixins & {
  /**
   * The default spacing in pixels between composed sub-views.
   *
   * __Default value__: `20`
   */
  spacing?: number;
};

export interface CompositionConfigMixins {
  /** Default configuration for the `facet` view composition operator */
  facet?: CompositionConfig;

  /** Default configuration for all concatenation view composition operators (`concat`, `hconcat`, and `vconcat`) */
  concat?: CompositionConfig;

  /** Default configuration for the `repeat` view composition operator */
  repeat?: CompositionConfig;
}

const COMPOSITION_LAYOUT_INDEX: Flag<keyof GenericCompositionLayoutWithColumns> = {
  align: 1,
  bounds: 1,
  center: 1,
  columns: 1,
  spacing: 1
};

const COMPOSITION_LAYOUT_PROPERTIES = keys(COMPOSITION_LAYOUT_INDEX);

export type SpecType = 'unit' | 'facet' | 'layer' | 'concat' | 'repeat';

export function extractCompositionLayout(
  spec: NormalizedSpec,
  specType: SpecType,
  config: Config
): GenericCompositionLayoutWithColumns {
  const compositionConfig = config[specType];
  const layout: GenericCompositionLayoutWithColumns = {};

  // Apply config first
  const {spacing: spacingConfig, columns} = compositionConfig;
  if (spacingConfig !== undefined) {
    layout.spacing = spacingConfig;
  }

  if (columns !== undefined) {
    if (
      (isFacetSpec(spec) && !isFacetMapping(spec.facet)) ||
      (isRepeatSpec(spec) && isArray(spec.repeat)) ||
      isConcatSpec(spec)
    ) {
      layout.columns = columns;
    }
  }

  // Then copy properties from the spec

  for (const prop of COMPOSITION_LAYOUT_PROPERTIES) {
    if (spec[prop] !== undefined) {
      if (prop === 'spacing') {
        const spacing: number | RowCol<number> = spec[prop];

        layout[prop] = isNumber(spacing)
          ? spacing
          : {
              row: spacing.row ?? spacingConfig,
              column: spacing.column ?? spacingConfig
            };
      } else {
        (layout[prop] as any) = spec[prop];
      }
    }
  }

  return layout;
}

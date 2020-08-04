import {Color} from 'vega';
import {BaseSpec} from '.';
import {getPositionScaleChannel} from '../channel';
import {Config} from '../config';
import {InlineDataset} from '../data';
import {Dict} from '../util';

/**
 * @minimum 0
 */
export type Padding = number | {top?: number; bottom?: number; left?: number; right?: number};

export type Datasets = Dict<InlineDataset>;

export type TopLevel<S extends BaseSpec> = S &
  TopLevelProperties & {
    /**
     * URL to [JSON schema](http://json-schema.org/) for a Vega-Lite specification. Unless you have a reason to change this, use `https://vega.github.io/schema/vega-lite/v4.json`. Setting the `$schema` property allows automatic validation and autocomplete in editors that support JSON schema.
     * @format uri
     */
    $schema?: string;

    /**
     * Vega-Lite configuration object. This property can only be defined at the top-level of a specification.
     */
    config?: Config;

    /**
     * A global data store for named datasets. This is a mapping from names to inline datasets.
     * This can be an array of objects or primitive values or a string. Arrays of primitive values are ingested as objects with a `data` property.
     */
    datasets?: Datasets;

    /**
     * Optional metadata that will be passed to Vega.
     * This object is completely ignored by Vega and Vega-Lite and can be used for custom metadata.
     */
    usermeta?: object;
  };

export interface TopLevelProperties {
  /**
   * CSS color property to use as the background of the entire view.
   *
   * __Default value:__ `"white"`
   */
  background?: Color;

  /**
   * The default visualization padding, in pixels, from the edge of the visualization canvas to the data rectangle. If a number, specifies padding for all sides.
   * If an object, the value should have the format `{"left": 5, "top": 5, "right": 5, "bottom": 5}` to specify padding for each side of the visualization.
   *
   * __Default value__: `5`
   */
  padding?: Padding;

  /**
   * How the visualization size should be determined. If a string, should be one of `"pad"`, `"fit"` or `"none"`.
   * Object values can additionally specify parameters for content sizing and automatic resizing.
   *
   * __Default value__: `pad`
   */
  autosize?: AutosizeType | AutoSizeParams;
}

export type FitType = 'fit' | 'fit-x' | 'fit-y';

export function isFitType(autoSizeType: AutosizeType): autoSizeType is FitType {
  return autoSizeType === 'fit' || autoSizeType === 'fit-x' || autoSizeType === 'fit-y';
}

export function getFitType(sizeType?: 'width' | 'height'): FitType {
  return sizeType ? (`fit-${getPositionScaleChannel(sizeType)}` as FitType) : 'fit';
}

export type AutosizeType = 'pad' | 'none' | 'fit' | 'fit-x' | 'fit-y';

export interface AutoSizeParams {
  /**
   * The sizing format type. One of `"pad"`, `"fit"`, `"fit-x"`, `"fit-y"`,  or `"none"`. See the [autosize type](https://vega.github.io/vega-lite/docs/size.html#autosize) documentation for descriptions of each.
   *
   * __Default value__: `"pad"`
   */
  type?: AutosizeType;

  /**
   * A boolean flag indicating if autosize layout should be re-calculated on every view update.
   *
   * __Default value__: `false`
   */
  resize?: boolean;

  /**
   * Determines how size calculation should be performed, one of `"content"` or `"padding"`. The default setting (`"content"`) interprets the width and height settings as the data rectangle (plotting) dimensions, to which padding is then added. In contrast, the `"padding"` setting includes the padding within the view size calculations, such that the width and height settings indicate the **total** intended size of the view.
   *
   * __Default value__: `"content"`
   */
  contains?: 'content' | 'padding';
}

const TOP_LEVEL_PROPERTIES: (keyof TopLevelProperties)[] = [
  'background',
  'padding'
  // We do not include "autosize" here as it is supported by only unit and layer specs and thus need to be normalized
];

export function extractTopLevelProperties<T extends TopLevelProperties>(t: T) {
  return TOP_LEVEL_PROPERTIES.reduce((o, p) => {
    if (t && t[p] !== undefined) {
      o[p] = t[p];
    }
    return o;
  }, {});
}

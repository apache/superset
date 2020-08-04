import {isBoolean, isObject} from 'vega-util';
import {
  Channel,
  COLOR,
  COLUMN,
  FILL,
  FILLOPACITY,
  OPACITY,
  ROW,
  SHAPE,
  SIZE,
  STROKE,
  STROKEOPACITY,
  STROKEWIDTH
} from './channel';
import {normalizeBin} from './channeldef';
import {SelectionExtent} from './selection';
import {keys, varName} from './util';

export interface BaseBin {
  /**
   * The number base to use for automatic bin determination (default is base 10).
   *
   * __Default value:__ `10`
   *
   */
  base?: number;
  /**
   * An exact step size to use between bins.
   *
   * __Note:__ If provided, options such as maxbins will be ignored.
   */
  step?: number;
  /**
   * An array of allowable step sizes to choose from.
   * @minItems 1
   */
  steps?: number[];
  /**
   * A minimum allowable step size (particularly useful for integer values).
   */
  minstep?: number;
  /**
   * Scale factors indicating allowable subdivisions. The default value is [5, 2], which indicates that for base 10 numbers (the default base), the method may consider dividing bin sizes by 5 and/or 2. For example, for an initial step size of 10, the method can check if bin sizes of 2 (= 10/5), 5 (= 10/2), or 1 (= 10/(5*2)) might also satisfy the given constraints.
   *
   * __Default value:__ `[5, 2]`
   *
   * @minItems 1
   */
  divide?: [number, number];
  /**
   * Maximum number of bins.
   *
   * __Default value:__ `6` for `row`, `column` and `shape` channels; `10` for other channels
   *
   * @minimum 2
   */
  maxbins?: number;
  /**
   * A value in the binned domain at which to anchor the bins, shifting the bin boundaries if necessary to ensure that a boundary aligns with the anchor value.
   *
   * __Default value:__ the minimum bin extent value
   */
  anchor?: number;
  /**
   * If true, attempts to make the bin boundaries use human-friendly boundaries, such as multiples of ten.
   *
   * __Default value:__ `true`
   */
  nice?: boolean;
}

/**
 * Binning properties or boolean flag for determining whether to bin data or not.
 */
export interface BinParams extends BaseBin {
  /**
   * A two-element (`[min, max]`) array indicating the range of desired bin values.
   */
  extent?: BinExtent; // VgBinTransform uses a different extent so we need to pull this out.

  /**
   * When set to `true`, Vega-Lite treats the input data as already binned.
   */
  binned?: boolean;
}

export type Bin = boolean | BinParams | 'binned' | null;

export type BinExtent = [number, number] | SelectionExtent;

/**
 * Create a key for the bin configuration. Not for prebinned bin.
 */
export function binToString(bin: BinParams | true) {
  if (isBoolean(bin)) {
    bin = normalizeBin(bin, undefined);
  }
  return (
    'bin' +
    keys(bin)
      .map(p => (isSelectionExtent(bin[p]) ? varName(`_${p}_${Object.entries(bin[p])}`) : varName(`_${p}_${bin[p]}`)))
      .join('')
  );
}

/**
 * Vega-Lite should bin the data.
 */
export function isBinning(bin: BinParams | boolean | 'binned'): bin is BinParams | true {
  return bin === true || (isBinParams(bin) && !bin.binned);
}

/**
 * The data is already binned and so Vega-Lite should not bin it again.
 */
export function isBinned(bin: BinParams | boolean | 'binned'): bin is 'binned' {
  return bin === 'binned' || (isBinParams(bin) && bin.binned === true);
}

export function isBinParams(bin: BinParams | boolean | 'binned'): bin is BinParams {
  return isObject(bin);
}

export function isSelectionExtent(extent: BinExtent): extent is SelectionExtent {
  return extent?.['selection'];
}

export function autoMaxBins(channel?: Channel): number {
  switch (channel) {
    case ROW:
    case COLUMN:
    case SIZE:
    case COLOR:
    case FILL:
    case STROKE:
    case STROKEWIDTH:
    case OPACITY:
    case FILLOPACITY:
    case STROKEOPACITY:
    // Facets and Size shouldn't have too many bins
    // We choose 6 like shape to simplify the rule [falls through]
    case SHAPE:
      return 6; // Vega's "shape" has 6 distinct values
    default:
      return 10;
  }
}

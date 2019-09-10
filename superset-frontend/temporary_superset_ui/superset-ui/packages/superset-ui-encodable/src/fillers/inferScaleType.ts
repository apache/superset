import { Type, ScaleType } from '../types/VegaLite';
import { ChannelType } from '../types/Channel';

/**
 * Sometimes scale type is not specified but can be inferred
 * from other fields.
 * See https://vega.github.io/vega-lite/docs/scale.html
 * @param channelType type of the channel
 * @param fieldType type of the field
 * @param bin is value binned
 */
// eslint-disable-next-line complexity
export default function inferScaleType(
  channelType: ChannelType,
  fieldType?: Type,
  bin: boolean = false,
): ScaleType | undefined {
  if (fieldType === 'nominal' || fieldType === 'ordinal') {
    switch (channelType) {
      // For positional (x and y) ordinal and ordinal fields,
      // "point" is the default scale type for all marks
      // except bar and rect marks, which use "band" scales.
      // https://vega.github.io/vega-lite/docs/scale.html
      case 'XBand':
      case 'YBand':
        return ScaleType.BAND;
      case 'X':
      case 'Y':
      case 'Numeric':
        return ScaleType.POINT;
      case 'Color':
      case 'Category':
        return ScaleType.ORDINAL;
      default:
    }
  } else if (fieldType === 'quantitative') {
    switch (channelType) {
      case 'XBand':
      case 'YBand':
      case 'X':
      case 'Y':
      case 'Numeric':
        return ScaleType.LINEAR;
      case 'Color':
        return bin ? ScaleType.BIN_ORDINAL : ScaleType.LINEAR;
      default:
    }
  } else if (fieldType === 'temporal') {
    switch (channelType) {
      case 'XBand':
      case 'YBand':
      case 'X':
      case 'Y':
      case 'Numeric':
        return ScaleType.UTC;
      case 'Color':
        return ScaleType.LINEAR;
      default:
    }
  }

  return undefined;
}

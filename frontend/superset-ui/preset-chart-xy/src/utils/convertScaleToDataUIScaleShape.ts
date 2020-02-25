import { Value } from 'vega-lite/build/src/channeldef';
import { Scale } from '../encodeable/types/Scale';

type DataUIScaleType = 'time' | 'timeUtc' | 'linear' | 'band';

interface DataUIScale {
  type: DataUIScaleType;
  domain?: number[] | string[];
  includeZero?: boolean;
  nice?: boolean;
  paddingInner?: number;
  paddingOuter?: number;
  range?: number[] | string[];
  rangeRound?: number[] | string[];
}

function isCompatibleDomainOrRange(
  array: Scale['domain'] | Scale['range'],
): array is number[] | string[] {
  return (
    typeof array !== 'undefined' &&
    array.length > 0 &&
    (typeof array[0] === 'string' || typeof array[0] === 'number')
  );
}

/**
 * Convert encodeable scale object into @data-ui's scale config
 * @param scale
 */
export default function convertScaleToDataUIScale<Output extends Value>(scale: Scale<Output>) {
  const { type, domain, range, nice, paddingInner, paddingOuter } = scale;

  let outputType: DataUIScaleType;

  if (type === 'linear' || type === 'time' || type === 'band') {
    outputType = type;
  } else if (type === 'utc') {
    outputType = 'timeUtc';
  } else {
    throw new Error(`Unsupported scale type: ${type}`);
  }

  const output: DataUIScale = { type: outputType };
  if (isCompatibleDomainOrRange(domain)) {
    output.domain = domain;
  }
  if (isCompatibleDomainOrRange(range)) {
    output.range = range;
  }
  if (typeof nice !== 'undefined') {
    output.nice = nice;
  }
  if (typeof paddingInner !== 'undefined') {
    output.paddingInner = paddingInner;
  }
  if (typeof paddingOuter !== 'undefined') {
    output.paddingOuter = paddingOuter;
  }

  return output;
}

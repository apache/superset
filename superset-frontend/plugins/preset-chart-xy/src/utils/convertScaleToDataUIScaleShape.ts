import { Value, ScaleConfig } from 'encodable';

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
  array: ScaleConfig['domain'] | ScaleConfig['range'],
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
export default function convertScaleToDataUIScale<Output extends Value>(
  scale: ScaleConfig<Output>,
) {
  const { type, domain, range } = scale;

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
  if ('nice' in scale && typeof scale.nice === 'boolean') {
    output.nice = scale.nice;
  }
  if ('paddingInner' in scale && typeof scale.paddingInner !== 'undefined') {
    output.paddingInner = scale.paddingInner;
  }
  if ('paddingOuter' in scale && typeof scale.paddingOuter !== 'undefined') {
    output.paddingOuter = scale.paddingOuter;
  }

  return output;
}

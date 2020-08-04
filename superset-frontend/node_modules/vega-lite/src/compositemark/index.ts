import {Field} from '../channeldef';
import {Encoding} from '../encoding';
import {NormalizerParams} from '../normalize';
import {GenericUnitSpec, NormalizedLayerSpec} from '../spec';
import {EncodingFacetMapping} from '../spec/facet';
import {keys} from '../util';
import {CompositeMarkNormalizer} from './base';
import {BOXPLOT, BoxPlot, BOXPLOT_PARTS, BoxPlotConfigMixins, BoxPlotDef, normalizeBoxPlot} from './boxplot';
import {
  ERRORBAND,
  ErrorBand,
  ERRORBAND_PARTS,
  ErrorBandConfigMixins,
  ErrorBandDef,
  normalizeErrorBand
} from './errorband';
import {
  ERRORBAR,
  ErrorBar,
  ERRORBAR_PARTS,
  ErrorBarConfigMixins,
  ErrorBarDef,
  ErrorExtraEncoding,
  normalizeErrorBar
} from './errorbar';

export {BoxPlotConfig} from './boxplot';
export {ErrorBandConfigMixins} from './errorband';
export {ErrorBarConfigMixins} from './errorbar';

export type CompositeMarkNormalizerRun = (
  spec: GenericUnitSpec<any, any>,
  params: NormalizerParams
) => NormalizedLayerSpec;

/**
 * Registry index for all composite mark's normalizer
 */
const compositeMarkRegistry: {
  [mark: string]: {
    normalizer: CompositeMarkNormalizer<any>;
    parts: string[];
  };
} = {};

export function add(mark: string, run: CompositeMarkNormalizerRun, parts: string[]) {
  const normalizer = new CompositeMarkNormalizer(mark, run);
  compositeMarkRegistry[mark] = {normalizer, parts};
}

export function remove(mark: string) {
  delete compositeMarkRegistry[mark];
}

export type CompositeEncoding = Encoding<Field> & ErrorExtraEncoding<Field>;
export type FacetedCompositeEncoding = Encoding<Field> & ErrorExtraEncoding<Field> & EncodingFacetMapping<Field>;

export type CompositeMark = BoxPlot | ErrorBar | ErrorBand;

export function getAllCompositeMarks() {
  return keys(compositeMarkRegistry);
}

export type CompositeMarkDef = BoxPlotDef | ErrorBarDef | ErrorBandDef;

export type CompositeAggregate = BoxPlot | ErrorBar | ErrorBand;

export interface CompositeMarkConfigMixins extends BoxPlotConfigMixins, ErrorBarConfigMixins, ErrorBandConfigMixins {}

add(BOXPLOT, normalizeBoxPlot, BOXPLOT_PARTS);
add(ERRORBAR, normalizeErrorBar, ERRORBAR_PARTS);
add(ERRORBAND, normalizeErrorBand, ERRORBAND_PARTS);

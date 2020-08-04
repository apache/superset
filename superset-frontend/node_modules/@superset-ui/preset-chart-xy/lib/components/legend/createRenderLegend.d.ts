/// <reference types="react" />
import { Encoder, EncodingConfig, Dataset } from 'encodable';
import { LegendHooks } from './types';
export default function createRenderLegend<Config extends EncodingConfig>(encoder: Encoder<Config>, data: Dataset, props: LegendHooks<Config>): (() => JSX.Element) | undefined;
//# sourceMappingURL=createRenderLegend.d.ts.map
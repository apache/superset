import { stackOffsetExpand, stackOffsetDiverging, stackOffsetNone, stackOffsetSilhouette, stackOffsetWiggle } from 'd3-shape';
export declare const STACK_OFFSETS: {
    expand: typeof stackOffsetExpand;
    diverging: typeof stackOffsetDiverging;
    none: typeof stackOffsetNone;
    silhouette: typeof stackOffsetSilhouette;
    wiggle: typeof stackOffsetWiggle;
};
export declare const STACK_OFFSET_NAMES: string[];
export default function stackOffset(offset?: keyof typeof STACK_OFFSETS): typeof stackOffsetExpand;
//# sourceMappingURL=stackOffset.d.ts.map
import { Margin } from '@superset-ui/core';
export declare const DEFAULT_MARGIN: {
    bottom: number;
    left: number;
    right: number;
    top: number;
};
export default function createMarginSelector(defaultMargin?: Margin): import("reselect").OutputSelector<Partial<Margin>, {
    bottom: number;
    left: number;
    right: number;
    top: number;
}, (res1: number | undefined, res2: number | undefined, res3: number | undefined, res4: number | undefined) => {
    bottom: number;
    left: number;
    right: number;
    top: number;
}>;
//# sourceMappingURL=createMarginSelector.d.ts.map
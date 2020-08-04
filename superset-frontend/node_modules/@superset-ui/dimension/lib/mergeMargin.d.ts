import { Margin } from './types';
export default function mergeMargin(margin1?: Partial<Margin>, margin2?: Partial<Margin>, mode?: 'expand' | 'shrink'): {
    bottom: number;
    left: number;
    right: number;
    top: number;
};
//# sourceMappingURL=mergeMargin.d.ts.map
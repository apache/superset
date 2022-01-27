import { QueryFormData } from '@superset-ui/core';
import { RotationType } from '../chart/WordCloud';
export declare type LegacyWordCloudFormData = QueryFormData & {
    colorScheme: string;
    rotation?: RotationType;
    series: string;
    sizeFrom?: number;
    sizeTo: number;
};
//# sourceMappingURL=types.d.ts.map
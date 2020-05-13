import { QueryFormData } from '@superset-ui/query';
import { RotationType } from '../chart/WordCloud';

export type LegacyWordCloudFormData = QueryFormData & {
  colorScheme: string;
  rotation?: RotationType;
  series: string;
  sizeFrom?: number;
  sizeTo: number;
};

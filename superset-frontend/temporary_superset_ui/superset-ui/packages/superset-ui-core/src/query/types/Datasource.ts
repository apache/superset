import { Column } from './Column';
import { QueryObjectMetric } from './Query';

export enum DatasourceType {
  Table = 'table',
  Druid = 'druid',
}

/** @TODO can continue to add fields to this */
export interface Datasource {
  id: number;
  name: string;
  type: DatasourceType;
  columns: Column[];
  metrics: QueryObjectMetric[];
  description?: string;
  // key is column names (labels)
  columnFormats?: {
    [key: string]: string;
  };
  verboseMap?: {
    [key: string]: string;
  };
}

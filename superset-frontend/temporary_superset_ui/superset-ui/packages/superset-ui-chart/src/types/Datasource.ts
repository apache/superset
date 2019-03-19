import { Column } from './Column';
import { Metric } from './Metric';

export enum DatasourceType {
  Table = 'table',
  Druid = 'druid',
}

/** @TODO can continue to add fields to this */
export interface Datasource {
  id: number;
  name: string;
  description?: string;
  type: DatasourceType;
  columns: Column[];
  metrics: Metric[];
}

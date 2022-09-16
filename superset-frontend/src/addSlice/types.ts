import { ReactNode } from 'react';

export type Column = {
  column_name: string;
};

export type DatasetValue = {
  schema: string;
  table_name: string;
  database_name: string;
  column_names: string[];
};

export type Dataset = {
  id: number;
  schema: string;
  table_name: string;
  description: string;
  datasource_type: string;
  database: {
    database_name: string;
  };
  columns: Column[];
};

export type StateDataset = {
  label: string;
  value: string;
  schema: string;
  table_name: string;
  database_name: string;
  column_names: string[];
};

export type AdditionalStateDataset = {
  label?: string;
  value?: string;
  schema?: string;
  join_type?: string;
  table_name?: string;
  database_name?: string;
  column_names?: string[];
};

export type List = {
  key: number;
  label: string;
  value: string;
  schema: string;
  table_name: string;
  database_name: string;
  customLabel: ReactNode;
  column_names: string[];
};

export type DatasourceJoin = {
  first_column: string;
  second_column: string;
};

export type DatasourceJoins = DatasourceJoin[];

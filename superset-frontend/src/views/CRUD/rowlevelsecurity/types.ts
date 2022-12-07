export enum FilterType {
  REGULAR = 'Regular',
  BASE = 'Base',
}

export type RLSObject = {
  id?: number;
  name: string;
  filter_type: FilterType;
  tables?: Array<Number>;
  roles?: Array<Number>;
  group_key?: string;
  clause?: string;
  description?: string;
};

export type MetaObject = {
  id?: number;
  label?: string;
  value?: number | string;
};

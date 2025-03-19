// DODO was here
import { ReactNode } from 'react';

export interface SortColumn {
  id: string;
  desc?: boolean;
}

export interface SelectOption {
  label: string;
  value: any;
}

export interface CardSortSelectOption {
  desc: boolean;
  id: any;
  label: string;
  value: any;
}

interface FilterDodoExtended {
  width?: number; // DODO added 44211759
}
export interface Filter extends FilterDodoExtended {
  Header: ReactNode;
  key: string;
  id: string;
  toolTipDescription?: string;
  urlDisplay?: string;
  operator?: FilterOperator;
  input?:
    | 'text'
    | 'textarea'
    | 'select'
    | 'checkbox'
    | 'search'
    | 'datetime_range';
  unfilteredLabel?: string;
  selects?: SelectOption[];
  onFilterOpen?: () => void;
  onFilterUpdate?: (value?: any) => void;
  fetchSelects?: (
    filterValue: string,
    page: number,
    pageSize: number,
  ) => Promise<{ data: SelectOption[]; totalCount: number }>;
  paginate?: boolean;
}

export type Filters = Filter[];

export type ViewModeType = 'card' | 'table';

export interface FilterValue {
  id: string;
  urlDisplay?: string;
  operator?: string;
  value:
    | string
    | boolean
    | number
    | null
    | undefined
    | string[]
    | number[]
    | { label: string; value: string | number };
}

export interface FetchDataConfig {
  pageIndex: number;
  pageSize: number;
  sortBy: SortColumn[];
  filters: FilterValue[];
}

export interface InternalFilter extends FilterValue {
  Header?: string;
}

export enum FilterOperator {
  StartsWith = 'sw',
  EndsWith = 'ew',
  Contains = 'ct',
  Equals = 'eq',
  NotStartsWith = 'nsw',
  NotEndsWith = 'new',
  NotContains = 'nct',
  NotEquals = 'neq',
  GreaterThan = 'gt',
  LessThan = 'lt',
  RelationManyMany = 'rel_m_m',
  RelationOneMany = 'rel_o_m',
  TitleOrSlug = 'title_or_slug',
  NameOrDescription = 'name_or_description',
  AllText = 'all_text',
  ChartAllText = 'chart_all_text',
  DatasetIsNullOrEmpty = 'dataset_is_null_or_empty',
  Between = 'between',
  DashboardIsFav = 'dashboard_is_favorite',
  ChartIsFav = 'chart_is_favorite',
  ChartIsCertified = 'chart_is_certified',
  DashboardIsCertified = 'dashboard_is_certified',
  DatasetIsCertified = 'dataset_is_certified',
  DashboardHasCreatedBy = 'dashboard_has_created_by',
  ChartHasCreatedBy = 'chart_has_created_by',
  DashboardTagByName = 'dashboard_tags',
  DashboardTagById = 'dashboard_tag_id',
  ChartTagByName = 'chart_tags',
  ChartTagById = 'chart_tag_id',
  SavedQueryTagByName = 'saved_query_tags',
  SavedQueryTagById = 'saved_query_tag_id',
}

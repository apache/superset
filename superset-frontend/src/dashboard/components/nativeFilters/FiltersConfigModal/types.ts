// DODO was here
import {
  AdhocFilter,
  DataMask,
  NativeFilterType,
  NativeFilterScope,
} from '@superset-ui/core';

// DODO added start 44211759
interface NativeFiltersFormItemDodoExtended {
  columnId?: string;
  selectTopValue?: string;
  nameRu?: string;
  columnRu: string;
}
// DODO added stop 44211759
export interface NativeFiltersFormItem
  extends NativeFiltersFormItemDodoExtended {
  scope: NativeFilterScope;
  name: string;
  filterType: string;
  dataset: {
    value: number;
    label: string;
  };
  column: string;
  controlValues: {
    [key: string]: any;
  };
  requiredFirst: {
    [key: string]: boolean;
  };
  defaultValue: any;
  defaultDataMask: DataMask;
  dependencies?: string[];
  sortMetric: string | null;
  adhoc_filters?: AdhocFilter[];
  time_range?: string;
  granularity_sqla?: string;
  type: typeof NativeFilterType.NativeFilter;
  description: string;
}
export interface NativeFilterDivider {
  id: string;
  type: typeof NativeFilterType.Divider;
  title: string;
  description: string;
}

export interface NativeFiltersForm {
  filters: Record<string, NativeFiltersFormItem | NativeFilterDivider>;
  changed?: boolean;
}

export type FilterRemoval =
  | null
  | {
      isPending: true; // the filter sticks around for a moment before removal is finalized
      timerId: number; // id of the timer that finally removes the filter
    }
  | { isPending: false };

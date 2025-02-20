import { DataMaskStateWithId, Filters } from '@superset-ui/core';

export type FilterSetFullData = {
  changed_by_fk: string | null;
  changed_on: string | null;
  created_by_fk: string | null;
  created_on: string | null;
  id: number;
  dashboard_id: number;
  description: string | null;
  name: string;
  owner_id: number;
  owner_type: string;
  params: { nativeFilters: Filters; dataMask: DataMaskStateWithId };
  is_primary: boolean;
};

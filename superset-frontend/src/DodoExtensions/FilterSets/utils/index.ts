// DODO was here

// eslint-disable-next-line import/no-extraneous-dependencies
import shortid from 'shortid';
import {
  DataMaskState,
  DataMaskStateWithId,
  DataMaskWithId,
  FilterSet,
  t,
} from '@superset-ui/core';
import { areObjectsEqual } from 'src/reduxUtils';
import { FilterSetFullData } from '../types';

export const generateFiltersSetId = () => `FILTERS_SET-${shortid.generate()}`;

export const APPLY_FILTERS_HINT = t('Please apply filter changes');

export const getFilterValueForDisplay = (
  value?: string[] | null | string | number | object,
): string => {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return `${value}`;
  }
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return t('Unknown value');
};

export const findExistingFilterSet = ({
  filterSetFilterValues,
  dataMaskSelected,
}: {
  filterSetFilterValues: FilterSet[];
  dataMaskSelected: DataMaskState;
}) =>
  filterSetFilterValues.find(({ dataMask: dataMaskFromFilterSet = {} }) => {
    const dataMaskSelectedEntries = Object.entries(dataMaskSelected);
    return dataMaskSelectedEntries.every(([id, filterFromSelectedFilters]) => {
      const isEqual = areObjectsEqual(
        filterFromSelectedFilters.filterState,
        dataMaskFromFilterSet?.[id]?.filterState,
        {
          ignoreUndefined: true,
          ignoreNull: true,
          ignoreFields: ['validateStatus'],
        },
      );
      const hasSamePropsNumber =
        dataMaskSelectedEntries.length ===
        Object.keys(dataMaskFromFilterSet ?? {}).length;
      return isEqual && hasSamePropsNumber;
    });
  });

export const getPrimaryFilterSetDataMask = (
  filterSets: FilterSet[] | null,
): DataMaskStateWithId | null => {
  if (!filterSets) return null;

  const primaryFilterSet = Object.values(filterSets).find(
    filterSet => filterSet.isPrimary,
  );
  if (!primaryFilterSet) return {};

  return Object.values(primaryFilterSet.dataMask).reduce(
    (prev, next: DataMaskWithId) => ({ ...prev, [next.id]: next }),
    {},
  ) as DataMaskStateWithId;
};

export const transformFilterSetFullData = (
  filterSets: FilterSetFullData[] | null,
): FilterSet[] | null =>
  filterSets
    ? filterSets.map(filterSet => ({
        ...filterSet.params,
        id: filterSet.id,
        name: filterSet.name,
        isPrimary: filterSet.is_primary,
      }))
    : null;

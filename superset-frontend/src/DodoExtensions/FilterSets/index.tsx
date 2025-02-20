// DODO was here

import { useEffect, useState } from 'react';
import {
  DataMask,
  DataMaskState,
  DataMaskWithId,
  Filter,
  Filters,
  FilterSet,
  HandlerFunction,
  styled,
  t,
} from '@superset-ui/core';
import { useDispatch } from 'react-redux';
import {
  createFilterSet,
  deleteFilterSet,
  updateFilterSet,
} from 'src/dashboard/actions/nativeFilters';
import { areObjectsEqual } from 'src/reduxUtils';
import {
  useFilters,
  useNativeFiltersDataMask,
  useFilterSets,
  usePendingFilterSetId,
} from 'src/dashboard/components/nativeFilters/FilterBar/state';
import { getFilterBarTestId } from 'src/dashboard/components/nativeFilters/FilterBar/utils';
import { TabIds } from 'src/dashboard/components/nativeFilters/FilterBar/types';
import { findExistingFilterSet } from './utils';
import Footer from './Footer';
import FilterSetUnit from './FilterSetUnit';

const FilterSetsWrapper = styled.div`
  display: grid;
  align-items: center;
  justify-content: center;
  grid-template-columns: 1fr;
  // 108px padding to make room for buttons with position: absolute
  padding-bottom: ${({ theme }) => theme.gridUnit * 27}px;

  & button.superset-button {
    margin-left: 0;
  }
  & input {
    width: 100%;
  }
`;

const FilterSetUnitWrapper = styled.div<{
  onClick?: HandlerFunction;
  'data-selected'?: boolean;
}>`
  ${({ theme, 'data-selected': selected, onClick }) => `
    position: relative;
    display: grid;
    align-items: center;
    justify-content: center;
    grid-template-columns: 1fr;
    grid-gap: ${theme.gridUnit}px;
    border-bottom: 1px solid ${theme.colors.grayscale.light2};
    padding: ${theme.gridUnit * 2}px ${theme.gridUnit * 4}px;
    cursor: ${!onClick ? 'auto' : 'pointer'};
    background: ${selected ? theme.colors.primary.light5 : 'transparent'};
  `}
`;

export type FilterSetsProps = {
  disabled: boolean;
  tab: TabIds;
  dataMaskSelected: DataMaskState;
  onEditFilterSet: (id: number) => void;
  onFilterSelectionChange: (
    filter: Pick<Filter, 'id'> & Partial<Filter>,
    dataMask: Partial<DataMask>,
  ) => void;
};

const DEFAULT_FILTER_SET_NAME = t('New filter set');
const FILTER_SET_ID_TO_BE_CREATED = -1; // DODO added 38080573

const FilterSets: React.FC<FilterSetsProps> = ({
  dataMaskSelected,
  onEditFilterSet,
  disabled,
  onFilterSelectionChange,
  tab,
}) => {
  const dispatch = useDispatch();
  const [filterSetName, setFilterSetName] = useState(DEFAULT_FILTER_SET_NAME);
  const [isFilterSetPrimary, setIsFilterSetPrimary] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const dataMaskApplied = useNativeFiltersDataMask();
  const filterSets = useFilterSets();
  const pendingFilterSetId = usePendingFilterSetId();
  const filterSetFilterValues = Object.values(filterSets);
  const filters = useFilters();
  const filterValues = Object.values(filters) as Filter[];
  const [selectedFiltersSetId, setSelectedFiltersSetId] = useState<
    number | null
  >(null);

  useEffect(() => {
    if (tab === TabIds.AllFilters) {
      return;
    }
    if (!filterSetFilterValues.length) {
      setSelectedFiltersSetId(null);
      return;
    }

    const foundFilterSet = findExistingFilterSet({
      dataMaskSelected,
      filterSetFilterValues,
    });

    setSelectedFiltersSetId(foundFilterSet?.id ?? null);
  }, [tab, dataMaskSelected, filterSetFilterValues]);

  const isFilterMissingOrContainsInvalidMetadata = (
    id: string,
    filterSet?: FilterSet,
  ) =>
    !filterValues.find(filter => filter?.id === id) ||
    !areObjectsEqual(
      filters[id]?.controlValues,
      filterSet?.nativeFilters?.[id]?.controlValues,
      {
        ignoreUndefined: true,
      },
    );

  const takeFilterSet = (id: number, event?: MouseEvent) => {
    const localTarget = event?.target as HTMLDivElement;
    if (localTarget) {
      const parent = localTarget.closest(
        `[data-anchor=${getFilterBarTestId('filter-set-wrapper', true)}]`,
      );
      if (
        parent?.querySelector('.ant-collapse-header')?.contains(localTarget) ||
        localTarget?.closest('.ant-dropdown')
      ) {
        return;
      }
    }
    setSelectedFiltersSetId(id);
    if (!id) {
      return;
    }

    const filterSet = filterSets[id];

    (Object.values(filterSet?.dataMask) ?? []).forEach(
      (dataMask: DataMaskWithId) => {
        const { extraFormData, filterState, id } = dataMask;
        if (isFilterMissingOrContainsInvalidMetadata(id, filterSet)) {
          return;
        }
        onFilterSelectionChange({ id }, { extraFormData, filterState });
      },
    );
  };

  const handleRebuild = (id: number) => {
    const filterSet = filterSets[id];
    // We need remove invalid filters from filter set
    const newFilters = Object.values(filterSet?.dataMask ?? {})
      .filter(dataMask => {
        const { id } = dataMask as DataMaskWithId;
        return !isFilterMissingOrContainsInvalidMetadata(id, filterSet);
      })
      .reduce(
        (prev, next: DataMaskWithId) => ({
          ...prev,
          [next.id]: filters[next.id],
        }),
        {},
      );

    const updatedFilterSet: FilterSet = {
      ...filterSet,
      nativeFilters: newFilters as Filters,
      dataMask: Object.keys(newFilters).reduce(
        (prev, nextFilterId) => ({
          ...prev,
          [nextFilterId]: filterSet.dataMask?.[nextFilterId],
        }),
        {},
      ),
    };
    dispatch(updateFilterSet(updatedFilterSet));
  };

  const handleEdit = (id: number) => {
    takeFilterSet(id);
    onEditFilterSet(id);
  };

  const handleDeleteFilterSet = (filterSetId: number) => {
    dispatch(deleteFilterSet(filterSetId));
    if (filterSetId === selectedFiltersSetId) {
      setSelectedFiltersSetId(null);
    }
  };

  const handleCancel = () => {
    setEditMode(false);
    setFilterSetName(DEFAULT_FILTER_SET_NAME);
  };

  const handleCreateFilterSet = () => {
    const newFilterSet: Omit<FilterSet, 'id'> = {
      name: filterSetName.trim(),
      nativeFilters: filters,
      dataMask: Object.keys(filters).reduce(
        (prev, nextFilterId) => ({
          ...prev,
          [nextFilterId]: dataMaskApplied[nextFilterId],
        }),
        {},
      ),
      isPrimary: isFilterSetPrimary,
    };
    dispatch(createFilterSet(newFilterSet));
    setEditMode(false);
    setFilterSetName(DEFAULT_FILTER_SET_NAME);
    setIsFilterSetPrimary(false);
  };

  const handleSetPrimary = (filterSet: FilterSet) => {
    const updatedFilterSet: FilterSet = { ...filterSet, isPrimary: true };
    dispatch(updateFilterSet(updatedFilterSet));
  };

  return (
    <FilterSetsWrapper>
      {!selectedFiltersSetId && (
        <FilterSetUnitWrapper>
          <FilterSetUnit
            dataMaskSelected={dataMaskSelected}
            editMode={editMode}
            setFilterSetName={setFilterSetName}
            filterSetName={filterSetName}
            isFilterSetPrimary={isFilterSetPrimary}
            setIsFilterSetPrimary={setIsFilterSetPrimary}
            isInPending={pendingFilterSetId === FILTER_SET_ID_TO_BE_CREATED}
          />
          <Footer
            filterSetName={filterSetName.trim()}
            disabled={disabled}
            onCancel={handleCancel}
            editMode={editMode}
            onEdit={() => setEditMode(true)}
            onCreate={handleCreateFilterSet}
          />
        </FilterSetUnitWrapper>
      )}
      {filterSetFilterValues.map(filterSet => (
        <FilterSetUnitWrapper
          {...getFilterBarTestId('filter-set-wrapper')}
          data-anchor={getFilterBarTestId('filter-set-wrapper', true)}
          data-selected={filterSet.id === selectedFiltersSetId}
          onClick={
            (e =>
              takeFilterSet(filterSet.id, e as MouseEvent)) as HandlerFunction
          }
          key={filterSet.id}
        >
          <FilterSetUnit
            isInPending={filterSet.id === pendingFilterSetId}
            isApplied={filterSet.id === selectedFiltersSetId && !disabled}
            isPrimary={filterSet.isPrimary}
            onSetPrimary={() => handleSetPrimary(filterSet)}
            onDelete={() => handleDeleteFilterSet(filterSet.id)}
            onEdit={() => handleEdit(filterSet.id)}
            onRebuild={() => handleRebuild(filterSet.id)}
            dataMaskSelected={dataMaskSelected}
            filterSet={filterSet}
          />
        </FilterSetUnitWrapper>
      ))}
    </FilterSetsWrapper>
  );
};

export default FilterSets;

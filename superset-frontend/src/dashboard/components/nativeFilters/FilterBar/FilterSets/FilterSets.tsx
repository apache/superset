/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import React, { useEffect, useState, MouseEvent } from 'react';
import { HandlerFunction, styled, t } from '@superset-ui/core';
import { useDispatch } from 'react-redux';
import { DataMaskState, DataMaskUnit, MaskWithId } from 'src/dataMask/types';
import { setFilterSetsConfiguration } from 'src/dashboard/actions/nativeFilters';
import { FilterSet } from 'src/dashboard/reducers/types';
import { findExistingFilterSet, generateFiltersSetId } from './utils';
import { Filter } from '../../types';
import { useFilters, useDataMask, useFilterSets } from '../state';
import Footer from './Footer';
import FilterSetUnit from './FilterSetUnit';

const FilterSetsWrapper = styled.div`
  display: grid;
  align-items: center;
  justify-content: center;
  grid-template-columns: 1fr;
  & button.superset-button {
    margin-left: 0;
  }
  & input {
    width: 100%;
  }
  & .ant-typography-edit-content {
    left: 0;
    margin-top: 0;
  }
`;

const FilterSetUnitWrapper = styled.div<{
  onClick?: HandlerFunction;
  selected?: boolean;
}>`
  display: grid;
  align-items: center;
  justify-content: center;
  grid-template-columns: 1fr;
  grid-gap: ${({ theme }) => theme.gridUnit}px;
  ${({ theme }) =>
    `padding: 0 ${theme.gridUnit * 4}px ${theme.gridUnit * 4}px`};
  border-bottom: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
  padding: ${({ theme }) => `${theme.gridUnit * 3}px ${theme.gridUnit * 2}px`};
  cursor: ${({ onClick }) => (!onClick ? 'auto' : 'pointer')};
  ${({ theme, selected }) =>
    `background: ${selected ? theme.colors.primary.light5 : 'transparent'}`};
`;

type FilterSetsProps = {
  disabled: boolean;
  dataMaskSelected: DataMaskUnit;
  onEditFilterSet: (id: string) => void;
  onFilterSelectionChange: (
    filter: Pick<Filter, 'id'> & Partial<Filter>,
    dataMask: Partial<DataMaskState>,
  ) => void;
};

const DEFAULT_FILTER_SET_NAME = t('New filter set');

const FilterSets: React.FC<FilterSetsProps> = ({
  dataMaskSelected,
  onEditFilterSet,
  disabled,
  onFilterSelectionChange,
}) => {
  const dispatch = useDispatch();
  const [filterSetName, setFilterSetName] = useState(DEFAULT_FILTER_SET_NAME);
  const [editMode, setEditMode] = useState(false);
  const dataMaskApplied = useDataMask();
  const filterSets = useFilterSets();
  const filterSetFilterValues = Object.values(filterSets);
  const filters = Object.values(useFilters());
  const [selectedFiltersSetId, setSelectedFiltersSetId] = useState<
    string | null
  >(null);

  useEffect(() => {
    const foundFilterSet = findExistingFilterSet({
      dataMaskApplied,
      dataMaskSelected,
      filterSetFilterValues,
    });
    setSelectedFiltersSetId(foundFilterSet?.id ?? null);
  }, [dataMaskApplied, dataMaskSelected, filterSetFilterValues]);

  const takeFilterSet = (id: string, target?: HTMLElement) => {
    const ignoreSelector = 'ant-collapse-header';
    if (
      target?.classList.contains(ignoreSelector) ||
      target?.parentElement?.classList.contains(ignoreSelector) ||
      target?.parentElement?.parentElement?.classList.contains(
        ignoreSelector,
      ) ||
      target?.parentElement?.parentElement?.parentElement?.classList.contains(
        ignoreSelector,
      )
    ) {
      // We don't want select filter set when user expand filters
      return;
    }
    setSelectedFiltersSetId(id);
    if (!id) {
      return;
    }
    const filtersSet = filterSets[id];
    Object.values(filtersSet.dataMask?.nativeFilters ?? []).forEach(
      dataMask => {
        const { extraFormData, currentState, id } = dataMask as MaskWithId;
        onFilterSelectionChange(
          { id },
          { nativeFilters: { extraFormData, currentState } },
        );
      },
    );
  };

  const handleEdit = (id: string) => {
    takeFilterSet(id);
    onEditFilterSet(id);
  };

  const handleDeleteFilterSets = () => {
    dispatch(
      setFilterSetsConfiguration(
        filterSetFilterValues.filter(
          filtersSet => filtersSet.id !== selectedFiltersSetId,
        ),
      ),
    );
    setFilterSetName(DEFAULT_FILTER_SET_NAME);
    setSelectedFiltersSetId(null);
  };

  const handleCancel = () => {
    setEditMode(false);
    setFilterSetName(DEFAULT_FILTER_SET_NAME);
  };

  const handleCreateFilterSet = () => {
    const newFilterSet: FilterSet = {
      name: filterSetName.trim(),
      id: generateFiltersSetId(),
      dataMask: {
        nativeFilters: dataMaskApplied,
      },
    };
    dispatch(
      setFilterSetsConfiguration([newFilterSet].concat(filterSetFilterValues)),
    );
    setEditMode(false);
    setFilterSetName(DEFAULT_FILTER_SET_NAME);
  };

  return (
    <FilterSetsWrapper>
      {!selectedFiltersSetId && (
        <FilterSetUnitWrapper>
          <FilterSetUnit
            filters={filters}
            editMode={editMode}
            setFilterSetName={setFilterSetName}
            filterSetName={filterSetName}
            dataMaskApplied={dataMaskApplied}
          />
          <Footer
            isApplyDisabled={!filterSetName.trim()}
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
          selected={filterSet.id === selectedFiltersSetId}
          onClick={(e: MouseEvent<HTMLElement>) =>
            takeFilterSet(filterSet.id, e.target as HTMLElement)
          }
        >
          <FilterSetUnit
            isApplied={filterSet.id === selectedFiltersSetId && !disabled}
            onDelete={handleDeleteFilterSets}
            onEdit={() => handleEdit(filterSet.id)}
            filters={filters}
            filterSet={filterSet}
          />
        </FilterSetUnitWrapper>
      ))}
    </FilterSetsWrapper>
  );
};

export default FilterSets;

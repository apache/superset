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
import { Select, Typography } from 'src/common/components';
import Button from 'src/components/Button';
import React, { useState } from 'react';
import { styled, t, tn } from '@superset-ui/core';
import { useDispatch } from 'react-redux';
import {
  DataMaskState,
  DataMaskUnitWithId,
  MaskWithId,
} from 'src/dataMask/types';
import { setFilterSetsConfiguration } from 'src/dashboard/actions/nativeFilters';
import { generateFiltersSetId } from './utils';
import { Filter } from '../../types';
import { useFilters, useDataMask, useFilterSets } from '../state';
import Footer from './Footer';
import FiltersHeader from './FiltersHeader';

const FilterSet = styled.div`
  display: grid;
  align-items: center;
  justify-content: center;
  grid-template-columns: 1fr;
  grid-gap: ${({ theme }) => theme.gridUnit}px;
  ${({ theme }) =>
    `padding: 0 ${theme.gridUnit * 4}px ${theme.gridUnit * 4}px`};
  border-bottom: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
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

type FilterSetsProps = {
  disabled: boolean;
  dataMaskState: DataMaskUnitWithId;
  onFilterSelectionChange: (
    filter: Pick<Filter, 'id'> & Partial<Filter>,
    dataMask: Partial<DataMaskState>,
  ) => void;
};

const DEFAULT_FILTER_SET_NAME = t('New filter set');

const FilterSets: React.FC<FilterSetsProps> = ({
  disabled,
  onFilterSelectionChange,
  dataMaskState,
}) => {
  const dispatch = useDispatch();
  const [filterSetName, setFilterSetName] = useState(DEFAULT_FILTER_SET_NAME);
  const [editMode, setEditMode] = useState(false);
  const filterSets = useFilterSets();
  const filterSetsArray = Object.values(filterSets);
  const dataMask = useDataMask();
  const filters = Object.values(useFilters());
  const [selectedFiltersSetId, setSelectedFiltersSetId] = useState<
    string | null
  >(null);

  const takeFilterSet = (value: string) => {
    setSelectedFiltersSetId(value);
    if (!value) {
      return;
    }
    const filtersSet = filterSets[value];
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

  const handleDeleteFilterSets = () => {
    dispatch(
      setFilterSetsConfiguration(
        filterSetsArray.filter(
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
    dispatch(
      setFilterSetsConfiguration(
        filterSetsArray.concat([
          {
            name: filterSetName.trim(),
            id: generateFiltersSetId(),
            dataMask: {
              nativeFilters: dataMaskState,
            },
          },
        ]),
      ),
    );
    setEditMode(false);
    setFilterSetName(DEFAULT_FILTER_SET_NAME);
  };

  return (
    <FilterSet>
      <Typography.Text
        strong
        editable={{
          editing: editMode,
          icon: <span />,
          onChange: setFilterSetName,
        }}
      >
        {filterSetName}
      </Typography.Text>
      <FiltersHeader dataMask={dataMask} filters={filters} />
      <Footer
        isApplyDisabled={!filterSetName.trim()}
        disabled={disabled}
        onCancel={handleCancel}
        editMode={editMode}
        onEdit={() => setEditMode(true)}
        onCreate={handleCreateFilterSet}
      />
      <Select
        size="small"
        allowClear
        value={selectedFiltersSetId as string}
        placeholder={tn('Available %d sets', filterSetsArray.length)}
        onChange={takeFilterSet}
      >
        {filterSetsArray.map(({ name, id }) => (
          <Select.Option value={id}>{name}</Select.Option>
        ))}
      </Select>
      <Button
        buttonStyle="warning"
        buttonSize="small"
        disabled={!selectedFiltersSetId}
        onClick={handleDeleteFilterSets}
        data-test="filter-save-filters-set-button"
      >
        {t('Delete Filters Set')}
      </Button>
    </FilterSet>
  );
};

export default FilterSets;

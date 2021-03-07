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
import { Select } from 'src/common/components';
import Button from 'src/components/Button';
import React, { useState } from 'react';
import { styled, t, tn } from '@superset-ui/core';
import { useDispatch, useSelector } from 'react-redux';
import {
  DataMaskState,
  DataMaskUnitWithId,
  MaskWithId,
} from 'src/dataMask/types';
import { setFilterSetsConfiguration } from 'src/dashboard/actions/nativeFilters';
import { FiltersSet } from 'src/dashboard/reducers/types';
import EditableTitle from 'src/components/EditableTitle';
import { generateFiltersSetId } from './utils';
import { Filter } from '../../types';
import { useFilterSets } from '../state';
import Footer from './Footer';

const FilterSet = styled.div`
  display: grid;
  align-items: center;
  justify-content: center;
  grid-template-columns: 1fr;
  grid-gap: 10px;
  ${({ theme }) =>
    `padding: 0 ${theme.gridUnit * 2}px ${theme.gridUnit * 4}px`};
  border-bottom: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
  & button.superset-button {
    margin-left: 0;
  }
`;

const StyledTitle = styled.h4`
  width: 100%;
  font-size: ${({ theme }) => theme.typography.sizes.s}px;
  color: ${({ theme }) => theme.colors.grayscale.dark1};
  margin: 0;
  overflow-wrap: break-word;

  & > .ant-select {
    width: 100%;
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
  const filterSetsConfigs = useSelector<any, FiltersSet[]>(
    state => state.dashboardInfo?.metadata?.filter_sets_configuration || [],
  );
  const [selectedFiltersSetId, setSelectedFiltersSetId] = useState<
    string | null
  >(null);

  const takeFiltersSet = (value: string) => {
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
        filterSetsConfigs.filter(
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
        filterSetsConfigs.concat([
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
    setFilterSetName(DEFAULT_FILTER_SET_NAME);
  };

  return (
    <FilterSet>
      <EditableTitle
        title={filterSetName}
        canEdit={editMode}
        onSaveTitle={setFilterSetName}
        showTooltip={false}
      />
      <StyledTitle>
        <div>{t('Choose filters set')}</div>
        <Select
          size="small"
          allowClear
          value={selectedFiltersSetId as string}
          placeholder={tn('Available %d sets', Object.keys(filterSets).length)}
          onChange={takeFiltersSet}
        >
          {Object.values(filterSets).map(({ name, id }) => (
            <Select.Option value={id}>{name}</Select.Option>
          ))}
        </Select>
      </StyledTitle>
      <Button
        buttonStyle="warning"
        buttonSize="small"
        disabled={!selectedFiltersSetId}
        onClick={handleDeleteFilterSets}
        data-test="filter-save-filters-set-button"
      >
        {t('Delete Filters Set')}
      </Button>
      <Footer
        isApplyDisabled={!filterSetName.trim()}
        disabled={disabled}
        onCancel={handleCancel}
        editMode={editMode}
        onEdit={() => setEditMode(true)}
        onCreate={handleCreateFilterSet}
      />
    </FilterSet>
  );
};

export default FilterSets;

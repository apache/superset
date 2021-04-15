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
import React, { FC, useMemo, useState } from 'react';
import { HandlerFunction, styled, t } from '@superset-ui/core';
import { Typography, Tooltip } from 'src/common/components';
import { useDispatch } from 'react-redux';
import Button from 'src/components/Button';
import { setFilterSetsConfiguration } from 'src/dashboard/actions/nativeFilters';
import { DataMaskState } from 'src/dataMask/types';
import { WarningOutlined } from '@ant-design/icons';
import { ActionButtons } from './Footer';
import { useDataMask, useFilters, useFilterSets } from '../state';
import { APPLY_FILTERS_HINT, findExistingFilterSet } from './utils';
import { useFilterSetNameDuplicated } from './state';

const Wrapper = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  align-items: flex-start;
  justify-content: flex-start;
  grid-gap: ${({ theme }) => theme.gridUnit}px;
  background: ${({ theme }) => theme.colors.primary.light4};
  padding: ${({ theme }) => theme.gridUnit * 2}px;
`;

const Title = styled(Typography.Text)`
  color: ${({ theme }) => theme.colors.primary.dark2};
`;

const Warning = styled(Typography.Text)`
  font-size: ${({ theme }) => theme.typography.sizes.s}px;
  & .anticon {
    padding: ${({ theme }) => theme.gridUnit}px;
  }
`;

const ActionButton = styled.div<{ disabled?: boolean }>`
  display: flex;
  & button {
    ${({ disabled }) => `pointer-events: ${disabled ? 'none' : 'all'}`};
    flex: 1;
  }
`;

export type EditSectionProps = {
  filterSetId: string;
  dataMaskSelected: DataMaskState;
  onCancel: HandlerFunction;
  disabled: boolean;
};

const EditSection: FC<EditSectionProps> = ({
  filterSetId,
  onCancel,
  dataMaskSelected,
  disabled,
}) => {
  const dataMaskApplied = useDataMask();
  const dispatch = useDispatch();
  const filterSets = useFilterSets();
  const filters = useFilters();
  const filterSetFilterValues = Object.values(filterSets);

  const [filterSetName, setFilterSetName] = useState(
    filterSets[filterSetId].name,
  );

  const isFilterSetNameDuplicated = useFilterSetNameDuplicated(
    filterSetName,
    filterSets[filterSetId].name,
  );

  const handleSave = () => {
    dispatch(
      setFilterSetsConfiguration(
        filterSetFilterValues.map(filterSet => {
          const newFilterSet = {
            ...filterSet,
            name: filterSetName,
            nativeFilters: filters,
            dataMask: { ...dataMaskApplied },
          };
          return filterSetId === filterSet.id ? newFilterSet : filterSet;
        }),
      ),
    );
    onCancel();
  };

  const foundFilterSet = useMemo(
    () =>
      findExistingFilterSet({
        dataMaskSelected,
        filterSetFilterValues,
      }),
    [dataMaskSelected, filterSetFilterValues],
  );

  const isDuplicateFilterSet =
    foundFilterSet && foundFilterSet.id !== filterSetId;

  const resultDisabled =
    disabled || isDuplicateFilterSet || isFilterSetNameDuplicated;

  return (
    <Wrapper>
      <Title strong>{t('Editing filter set:')}</Title>
      <Title
        editable={{
          editing: true,
          icon: <span />,
          onChange: setFilterSetName,
        }}
      >
        {filterSetName}
      </Title>
      <ActionButtons>
        <Button
          ghost
          buttonStyle="tertiary"
          buttonSize="small"
          onClick={onCancel}
          data-test="filter-set-edit-cancel"
        >
          {t('Cancel')}
        </Button>
        <Tooltip
          placement="right"
          title={
            (isFilterSetNameDuplicated &&
              t('Filter set with this name already exists')) ||
            (isDuplicateFilterSet && t('Filter set already exists')) ||
            (disabled && APPLY_FILTERS_HINT)
          }
        >
          <ActionButton disabled={resultDisabled}>
            <Button
              disabled={resultDisabled}
              buttonStyle="primary"
              htmlType="submit"
              buttonSize="small"
              onClick={handleSave}
              data-test="filter-set-edit-save"
            >
              {t('Save')}
            </Button>
          </ActionButton>
        </Tooltip>
      </ActionButtons>
      {isDuplicateFilterSet && (
        <Warning mark>
          <WarningOutlined />
          {t('This filter set is identical to: "%s"', foundFilterSet?.name)}
        </Warning>
      )}
    </Wrapper>
  );
};

export default EditSection;

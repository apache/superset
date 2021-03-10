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
import React, { FC, useMemo } from 'react';
import { HandlerFunction, styled, t } from '@superset-ui/core';
import { Typography } from 'src/common/components';
import { useDispatch } from 'react-redux';
import Button from 'src/components/Button';
import { setFilterSetsConfiguration } from 'src/dashboard/actions/nativeFilters';
import { ActionButtons } from './Footer';
import { useDataMask, useFilterSets } from '../state';
import { findExistingFilterSet } from './utils';

const Wrapper = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  align-items: flex-start;
  justify-content: flex-start;
  grid-gap: ${({ theme }) => theme.gridUnit}px;
  background: ${({ theme }) => theme.colors.primary.light4};
  padding: ${({ theme }) => theme.gridUnit * 2}px;
  & .ant-typography {
    font-size: ${({ theme }) => theme.typography.sizes.m}px;
    color: ${({ theme }) => theme.colors.primary.dark2};
  }
`;

type EditSectionProps = {
  filterSetId: string;
  onCancel: HandlerFunction;
  disabled: boolean;
};

const EditSection: FC<EditSectionProps> = ({
  filterSetId,
  onCancel,
  disabled,
}) => {
  const dataMaskApplied = useDataMask();
  const dispatch = useDispatch();
  const filterSets = useFilterSets();
  const filterSetFilterValues = Object.values(filterSets);
  const handleSave = () => {
    dispatch(
      setFilterSetsConfiguration(
        filterSetFilterValues.map(filterSet => {
          const newFilterSet = {
            ...filterSet,
            dataMask: { nativeFilters: { ...dataMaskApplied } },
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
        dataMaskApplied,
        currentDataMask,
        filterSetFilterValues,
      }),
    [dataMaskApplied, currentDataMask, filterSetFilterValues],
  );

  return (
    <Wrapper>
      <Typography.Text strong>{t('Editing filter set:')}</Typography.Text>
      <Typography.Text>{filterSets[filterSetId].name}</Typography.Text>
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
        <Button
          disabled={disabled}
          buttonStyle="primary"
          htmlType="submit"
          buttonSize="small"
          onClick={handleSave}
          data-test="filter-set-edit-save"
        >
          {t('Save')}
        </Button>
      </ActionButtons>
    </Wrapper>
  );
};

export default EditSection;

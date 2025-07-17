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

import { FC, memo, useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { styled, t, truncationCSS } from '@superset-ui/core';
import { Form, Select } from '@superset-ui/core/components';
import { RootState } from 'src/dashboard/types';
import { setPendingChartCustomization } from 'src/dashboard/actions/dashboardInfo';
import { ChartCustomizationItem } from './types';

const HorizontalGroupByContainer = styled(Form)`
  && .ant-form-item-label > label {
    margin-bottom: 0;
    text-transform: none;
  }
`;

const HorizontalFormItem = styled(Form.Item)`
  && {
    margin-bottom: 0;
    align-items: center;
  }

  .ant-form-item-label {
    display: flex;
    align-items: center;
    overflow: visible;
    padding-bottom: 0;
    margin-right: ${({ theme }) => theme.sizeUnit * 2}px;

    & > label {
      margin-bottom: 0;
      padding: 0;
      line-height: 1;
      font-size: ${({ theme }) => theme.fontSizeSM}px;
      font-weight: ${({ theme }) => theme.fontWeightNormal};
      color: ${({ theme }) => theme.colorText};
      ${truncationCSS};

      &::after {
        display: none;
      }
    }
  }

  .ant-form-item-control {
    min-width: 164px;
  }
`;

interface HorizontalGroupByControlProps {
  customizationItem: ChartCustomizationItem;
}

const HorizontalGroupByControl: FC<HorizontalGroupByControlProps> = ({
  customizationItem,
}) => {
  const dispatch = useDispatch();

  const loadedDatasets = useSelector(
    (state: RootState) => state.datasources || {},
  );

  const datasetInfo = useMemo(() => {
    const datasetId = customizationItem.customization?.dataset;
    return datasetId
      ? Object.values(loadedDatasets).find(ds => ds.id === Number(datasetId))
      : null;
  }, [loadedDatasets, customizationItem.customization?.dataset]);

  const columnOptions = useMemo(() => {
    if (!datasetInfo?.columns) return [];
    return datasetInfo.columns.map((col: { column_name: string }) => ({
      label: col.column_name,
      value: col.column_name,
    }));
  }, [datasetInfo]);

  const columnName = customizationItem.customization?.column;

  const label = useMemo(() => {
    const name = customizationItem.customization?.name;
    if (name) return name;
    if (customizationItem.title) return customizationItem.title;
    if (columnName) return columnName;
    return t('Group By');
  }, [
    customizationItem.customization?.name,
    customizationItem.title,
    columnName,
  ]);

  const handleChange = useCallback(
    (value: string) => {
      const updatedCustomization = {
        ...customizationItem.customization,
        column: value || null,
      };

      dispatch(
        setPendingChartCustomization({
          id: customizationItem.id,
          title: customizationItem.title,
          customization: updatedCustomization,
        }),
      );
    },
    [customizationItem, dispatch],
  );

  return (
    <HorizontalGroupByContainer layout="horizontal">
      <HorizontalFormItem label={label}>
        <Select
          allowClear
          placeholder={t('Select column...')}
          value={columnName || null}
          onChange={handleChange}
          options={columnOptions}
          showSearch
          filterOption={(
            input: string,
            option: { label: string; value: string } | undefined,
          ) =>
            ((option?.label as string) ?? '')
              .toLowerCase()
              .includes(input.toLowerCase())
          }
        />
      </HorizontalFormItem>
    </HorizontalGroupByContainer>
  );
};

export default memo(HorizontalGroupByControl);

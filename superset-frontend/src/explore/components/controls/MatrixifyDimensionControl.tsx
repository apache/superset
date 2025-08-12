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
import { useEffect, useState } from 'react';
import { t, SupersetClient, styled, getColumnLabel } from '@superset-ui/core';
import { Select } from '@superset-ui/core/components';
import ControlHeader from 'src/explore/components/ControlHeader';
import { optionLabel } from 'src/utils/common';

const StyledContainer = styled.div`
  .dimension-select {
    margin-bottom: ${({ theme }) => theme.sizeUnit * 2}px;
  }
`;

export interface MatrixifyDimensionControlValue {
  dimension: string;
  values: any[];
}

interface MatrixifyDimensionControlProps {
  datasource: any;
  value?: MatrixifyDimensionControlValue;
  onChange: (val: MatrixifyDimensionControlValue) => void;
  label?: string;
  description?: string;
  hovered?: boolean;
  selectionMode?: 'members' | 'topn';
}

export default function MatrixifyDimensionControl(
  props: MatrixifyDimensionControlProps,
) {
  const {
    datasource,
    value,
    onChange,
    label,
    description,
    hovered,
    selectionMode = 'members',
  } = props;

  const [dimensionOptions, setDimensionOptions] = useState<
    Array<[string, string]>
  >([]);
  const [valueOptions, setValueOptions] = useState<
    Array<{ label: string; value: any }>
  >([]);
  const [loadingValues, setLoadingValues] = useState(false);

  // Initialize dimension options from datasource
  useEffect(() => {
    if (datasource?.columns) {
      const options = datasource.columns.map((col: any) => [
        col.column_name,
        getColumnLabel(col.column_name),
      ]);
      setDimensionOptions(options);
    }
  }, [datasource]);

  // Load dimension values when dimension changes
  useEffect(() => {
    if (
      !value?.dimension ||
      !datasource ||
      !datasource.id ||
      selectionMode !== 'members'
    ) {
      setValueOptions([]);
      return undefined;
    }

    // Check if datasource supports filter_select
    if (datasource.filter_select === false) {
      setValueOptions([]);
      return undefined;
    }

    const controller = new AbortController();
    const { signal } = controller;

    const loadDimensionValues = async () => {
      const endpoint = `/api/v1/datasource/${
        datasource.type
      }/${datasource.id}/column/${encodeURIComponent(value.dimension)}/values/`;

      setLoadingValues(true);

      try {
        const { json } = await SupersetClient.get({
          signal,
          endpoint,
        });
        const values = json.result || [];
        setValueOptions(
          values.map((v: any) => ({
            label: optionLabel(v),
            value: v,
          })),
        );
      } catch (error) {
        console.error('Error loading dimension values:', error);
        setValueOptions([]);
      } finally {
        setLoadingValues(false);
      }
    };

    loadDimensionValues();

    return () => {
      controller.abort();
    };
  }, [value?.dimension, datasource, selectionMode]);

  const handleDimensionChange = (dimension: string) => {
    // When dimension changes, clear the values
    onChange({
      dimension: dimension || '',
      values: [],
    });
  };

  const handleValuesChange = (values: any[]) => {
    onChange({
      dimension: value?.dimension || '',
      values,
    });
  };

  return (
    <StyledContainer>
      <div className="dimension-select">
        <Select
          ariaLabel={t('Select dimension')}
          value={value?.dimension || undefined}
          header={
            <ControlHeader
              label={label || t('Dimension')}
              description={description || t('Select a dimension')}
              hovered={hovered}
            />
          }
          onChange={handleDimensionChange}
          options={dimensionOptions.map(([val, label]) => ({
            value: val,
            label,
          }))}
          placeholder={t('Select a dimension')}
          allowClear
        />
      </div>

      {value?.dimension && selectionMode === 'members' && (
        <Select
          ariaLabel={t('Select dimension values')}
          value={value?.values || []}
          header={
            <ControlHeader
              label={t('Dimension values')}
              description={t('Select dimension values')}
            />
          }
          mode="multiple"
          onChange={handleValuesChange}
          options={valueOptions}
          placeholder={t('Select values')}
          loading={loadingValues}
          allowClear
          showSearch
          notFoundContent={t('No results')}
        />
      )}
    </StyledContainer>
  );
}

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
import { useEffect, useState, useRef, useMemo } from 'react';
import { t, SupersetClient, getColumnLabel } from '@superset-ui/core';
import { Select, Space } from '@superset-ui/core/components';
import ControlHeader from 'src/explore/components/ControlHeader';
import { optionLabel } from 'src/utils/common';
import {
  fetchTopNValues,
  extractDimensionValues,
  TopNValue,
} from './MatrixifyControl/utils/fetchTopNValues';

export interface MatrixifyDimensionControlValue {
  dimension: string;
  values: any[];
  topNValues?: TopNValue[]; // Store topN values with their metric values
}

interface MatrixifyDimensionControlProps {
  datasource: any;
  value?: MatrixifyDimensionControlValue;
  onChange: (val: MatrixifyDimensionControlValue) => void;
  label?: string;
  description?: string;
  hovered?: boolean;
  renderTrigger?: boolean;
  selectionMode?: 'members' | 'topn';
  topNMetric?: string;
  topNValue?: number;
  topNOrder?: 'ASC' | 'DESC';
  formData?: any; // For access to filters and time range
  validationErrors?: string[];
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
    renderTrigger,
    selectionMode = 'members',
    topNMetric,
    topNValue,
    topNOrder = 'DESC',
    formData,
    validationErrors,
  } = props;

  const [dimensionOptions, setDimensionOptions] = useState<
    Array<[string, string]>
  >([]);
  const [valueOptions, setValueOptions] = useState<
    Array<{ label: string; value: any }>
  >([]);
  const [loadingValues, setLoadingValues] = useState(false);
  const [topNError, setTopNError] = useState<string | null>(null);
  const [dimensionHovered, setDimensionHovered] = useState(false);
  const [valuesHovered, setValuesHovered] = useState(false);
  const prevSelectionMode = useRef(selectionMode);

  // Reset values when selection mode changes
  useEffect(() => {
    if (prevSelectionMode.current !== selectionMode) {
      prevSelectionMode.current = selectionMode;
      if (value?.values && value.values.length > 0) {
        onChange({
          dimension: value.dimension,
          values: [],
          topNValues: [],
        });
      }
    }
  }, [selectionMode, value]);

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

  // Convert topNValue to number for consistent comparison
  const topNValueNum = useMemo(() => {
    if (topNValue === null || topNValue === undefined) {
      return null;
    }
    if (typeof topNValue === 'string') {
      if (topNValue === '') return null;
      const num = parseInt(topNValue, 10);
      return Number.isNaN(num) ? null : num;
    }
    return typeof topNValue === 'number' ? topNValue : null;
  }, [topNValue]);

  // Load TopN values when in TopN mode
  useEffect(() => {
    if (!value?.dimension || !datasource || selectionMode !== 'topn') {
      // Clear values when switching away from topn mode
      if (
        selectionMode !== 'topn' &&
        value?.values &&
        value.values.length > 0
      ) {
        onChange({
          dimension: value.dimension,
          values: [],
          topNValues: [],
        });
      }
      return undefined;
    }

    // If we don't have the required topN parameters, just return without loading
    if (!topNMetric || !topNValueNum || topNValueNum <= 0) {
      return undefined;
    }

    const controller = new AbortController();
    const { signal } = controller;

    const loadTopNValues = async () => {
      setTopNError(null);

      try {
        const datasourceId = `${datasource.id}__${datasource.type}`;
        const values = await fetchTopNValues({
          datasource: datasourceId,
          column: value.dimension,
          metric: topNMetric,
          limit: topNValueNum,
          sortAscending: topNOrder === 'ASC',
          filters: formData?.adhoc_filters || [],
          timeRange: formData?.time_range,
        });

        if (!signal.aborted) {
          // Always update with the new topN values
          const dimensionValues = extractDimensionValues(values);
          onChange({
            dimension: value.dimension,
            values: dimensionValues,
            topNValues: values,
          });
        }
      } catch (error: any) {
        if (!signal.aborted) {
          setTopNError(error.message || t('Failed to load top values'));
          // Clear values on error
          onChange({
            dimension: value.dimension,
            values: [],
            topNValues: [],
          });
        }
      }
    };

    loadTopNValues();

    return () => {
      controller.abort();
    };
  }, [
    value?.dimension,
    datasource,
    selectionMode,
    topNMetric,
    topNValueNum, // Use the converted/validated number
    topNOrder,
    formData?.adhoc_filters,
    formData?.time_range,
  ]);

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
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <div
        onMouseEnter={() => setDimensionHovered(true)}
        onMouseLeave={() => setDimensionHovered(false)}
      >
        <Select
          ariaLabel={t('Select dimension')}
          value={value?.dimension || undefined}
          header={
            <ControlHeader
              label={label || t('Dimension')}
              description={description || t('Select a dimension')}
              hovered={dimensionHovered}
              renderTrigger={renderTrigger}
              validationErrors={validationErrors}
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
        <div
          onMouseEnter={() => setValuesHovered(true)}
          onMouseLeave={() => setValuesHovered(false)}
        >
          <Select
            ariaLabel={t('Select dimension values')}
            value={value?.values || []}
            header={
              <ControlHeader
                label={t('Dimension values')}
                description={t('Select dimension values')}
                renderTrigger={renderTrigger}
                hovered={valuesHovered}
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
        </div>
      )}

      {value?.dimension && selectionMode === 'topn' && topNError && (
        <div css={theme => ({ color: theme.colorError })}>
          {t('Error: %s', topNError)}
        </div>
      )}
    </Space>
  );
}

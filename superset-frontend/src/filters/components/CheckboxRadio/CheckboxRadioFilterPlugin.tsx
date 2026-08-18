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
import { useMemo, useState, useCallback, useEffect } from 'react';
import { t } from '@apache-superset/core/translation';
import { styled } from '@apache-superset/core/theme';
import {
  DataMask,
  DataRecordValue,
  QueryObjectFilterClause,
} from '@superset-ui/core';
import {
  Select,
  Radio,
  Checkbox,
  FormItem,
} from '@superset-ui/core/components';
import { FilterPluginStyle } from '../common';
import { CheckboxRadioTransformedProps } from './types';

const Styles = styled.div<{ inCanvas?: boolean }>`
  width: 100%;
  min-height: 32px;
  padding: ${({ inCanvas, theme }) =>
    inCanvas ? `${theme.sizeUnit * 2}px` : '0'};
  overflow: visible;

  .ant-form-item {
    margin-bottom: 0;
  }

  .checkbox-radio-group {
    display: flex;
    flex-direction: ${({ inCanvas }) => (inCanvas ? 'column' : 'row')};
    gap: 8px;
    flex-wrap: wrap;
  }
`;

export default function CheckboxRadioFilterPlugin(
  props: CheckboxRadioTransformedProps,
) {
  const {
    data = [],
    height,
    width,
    controlType = 'Checkbox',
    filterColumn,
    orientation = 'vertical',
    inCanvas = false,
    setDataMask = () => {},
    filterState,
  } = props;

  const effectiveControlType: 'Radio' | 'Checkbox' =
    controlType === 'Radio' ? 'Radio' : 'Checkbox';

  // Extract canonical column name used in queries and query result rows
  const filterColumnName = useMemo(() => {
    if (!filterColumn) return '';
    if (typeof filterColumn === 'string') return filterColumn;
    return (
      filterColumn.column_name ||
      filterColumn.label ||
      filterColumn.sqlExpression ||
      'Custom SQL'
    );
  }, [filterColumn]);

  // Extract human-readable string for display labels
  const filterColumnLabel = useMemo(() => {
    if (!filterColumn) return '';
    if (typeof filterColumn === 'string') return filterColumn;
    return (
      filterColumn.label ||
      filterColumn.column_name ||
      filterColumn.sqlExpression ||
      t('Custom SQL')
    );
  }, [filterColumn]);

  // Initial local value is filterState if present
  const [localValue, setLocalValue] = useState(() => filterState?.value);

  const options = useMemo(() => {
    if (!filterColumnName || !data || data.length === 0) return [];

    const uniqueValues = new Set<string | number>();
    data.forEach(row => {
      const val =
        row[filterColumnName] ??
        (filterColumnLabel ? row[filterColumnLabel as string] : undefined);
      if (val !== undefined && val !== null) {
        uniqueValues.add(val as string | number);
      }
    });

    return Array.from(uniqueValues).map(val => ({
      label: String(val),
      value: val,
    }));
  }, [data, filterColumnName, filterColumnLabel]);

  const emitFilter = useCallback(
    (val: unknown) => {
      if (!filterColumnName) return;

      let cleanVal: DataRecordValue[] = [];
      if (Array.isArray(val)) {
        cleanVal = val as DataRecordValue[];
      } else if (val !== undefined && val !== null && val !== '') {
        cleanVal = [val as DataRecordValue];
      }

      const isEmpty = cleanVal.length === 0;

      const filters: QueryObjectFilterClause[] = isEmpty
        ? []
        : [
            {
              col: filterColumnName,
              op: 'IN',
              val: cleanVal,
            },
          ];

      const dataMask: DataMask = {
        extraFormData: {
          filters,
        },
        filterState: {
          value: isEmpty
            ? null
            : effectiveControlType === 'Radio'
              ? cleanVal[0]
              : cleanVal,
          label: isEmpty ? '' : cleanVal.join(', '),
        },
      };

      setDataMask(dataMask);
    },
    [filterColumnName, effectiveControlType, setDataMask],
  );

  const handleChange = (val: unknown) => {
    setLocalValue(val);
    emitFilter(val);
  };

  useEffect(() => {
    if (filterState?.value !== undefined) {
      setLocalValue(filterState.value);
    }
  }, [filterState?.value]);

  const renderControl = () => {
    // In Filter Bar (where space is tight) or Config Modal, render Checkbox/Radio in compact dropdown
    if (!inCanvas) {
      return (
        <Select
          headerPosition="left"
          ariaLabel={filterColumnLabel || t('Filter')}
          placeholder={
            filterColumnLabel
              ? t('Select %s', filterColumnLabel)
              : t('Select a value')
          }
          options={options}
          value={
            effectiveControlType === 'Radio'
              ? Array.isArray(localValue)
                ? localValue[0]
                : (localValue as any)
              : Array.isArray(localValue)
                ? (localValue as any)
                : localValue !== undefined && localValue !== null
                  ? [localValue as any]
                  : []
          }
          onChange={val => {
            if (effectiveControlType === 'Radio') {
              handleChange(val !== undefined && val !== null ? [val] : []);
            } else {
              handleChange(val || []);
            }
          }}
          allowClear
          getPopupContainer={() => document.body}
          mode={effectiveControlType === 'Checkbox' ? 'multiple' : 'single'}
        />
      );
    }

    const layoutStyle =
      orientation === 'horizontal'
        ? {
            display: 'flex',
            flexDirection: 'row' as const,
            flexWrap: 'wrap' as const,
            gap: '8px',
          }
        : { display: 'flex', flexDirection: 'column' as const, gap: '8px' };

    if (effectiveControlType === 'Radio') {
      return (
        <div
          className="custom-controls-scroll-container"
          style={{
            width: '100%',
            height: '100%',
            maxHeight: '100%',
            overflowY: 'auto',
            overflowX: 'hidden',
          }}
        >
          <Radio.Group
            style={layoutStyle}
            value={Array.isArray(localValue) ? localValue[0] : localValue}
            onChange={e => handleChange([e.target.value])}
          >
            {options.map(opt => (
              <Radio key={String(opt.value)} value={opt.value}>
                {opt.label}
              </Radio>
            ))}
          </Radio.Group>
        </div>
      );
    }

    return (
      <div
        className="custom-controls-scroll-container"
        style={{
          width: '100%',
          height: '100%',
          maxHeight: '100%',
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      >
        <Checkbox.Group
          style={layoutStyle}
          options={options}
          value={
            Array.isArray(localValue)
              ? (localValue as (string | number)[])
              : localValue !== undefined && localValue !== null
                ? [localValue as string | number]
                : []
          }
          onChange={handleChange}
        />
      </div>
    );
  };

  return (
    <FilterPluginStyle height={height} width={width}>
      <FormItem validateStatus={filterState?.validateStatus}>
        <Styles inCanvas={inCanvas}>{renderControl()}</Styles>
      </FormItem>
    </FilterPluginStyle>
  );
}

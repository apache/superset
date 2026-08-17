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
import { styled } from '@apache-superset/core/theme';
import { DataMask } from '@superset-ui/core';
import {
  Select,
  Radio,
  Checkbox,
  Input,
  FormItem,
} from '@superset-ui/core/components';
import { FilterPluginStyle } from '../common';
import { CustomControlsTransformedProps } from './types';

const Styles = styled.div<{ inCanvas?: boolean }>`
  width: 100%;
  min-height: 32px;
  padding: ${({ inCanvas, theme }) =>
    inCanvas ? `${theme.sizeUnit * 2}px` : '0px'};
  display: flex;
  flex-direction: column;
  justifyContent: center;

  .ant-select {
    width: 100%;
  }

  .ant-input {
    width: 100%;
  }
`;

export default function CustomControlsFilterPlugin(
  props: CustomControlsTransformedProps,
) {
  const {
    data,
    height,
    width,
    controlType,
    filterColumn,
    orientation,
    includeAllOption,
    multiSelect,
    inCanvas = false,
    setDataMask = () => {},
    filterState,
  } = props;

  // Extract human-readable string for Custom SQL dimensions
  const filterColumnLabel = useMemo(() => {
    if (!filterColumn) return '';
    if (typeof filterColumn === 'string') return filterColumn;
    return (
      filterColumn.label ||
      filterColumn.column_name ||
      filterColumn.sqlExpression ||
      'Custom SQL'
    );
  }, [filterColumn]);

  // Initial local value is filterState if present
  const [localValue, setLocalValue] = useState(() => filterState?.value);

  const options = useMemo(() => {
    if (!filterColumnLabel || !data || data.length === 0) return [];

    const uniqueValues = new Set<string | number>();
    data.forEach(row => {
      const val = row[filterColumnLabel];
      if (val !== undefined && val !== null) {
        uniqueValues.add(val as string | number);
      }
    });

    let opts = Array.from(uniqueValues).map(val => ({
      label: String(val),
      value: val,
    }));

    if (includeAllOption) {
      opts = [{ label: 'All', value: 'ALL_SELECTED' }, ...opts];
    }

    return opts;
  }, [data, filterColumnLabel, includeAllOption]);

  const emitFilter = useCallback(
    (val: unknown) => {
      if (!filterColumnLabel) return;

      const isAllSelected =
        val === 'ALL_SELECTED' ||
        (Array.isArray(val) && val.includes('ALL_SELECTED'));
      const isEmpty =
        isAllSelected ||
        val === undefined ||
        val === null ||
        val === '' ||
        (Array.isArray(val) && val.length === 0);

      let op: 'ILIKE' | 'IN' = 'IN';
      let filterVal: unknown = val;

      if (controlType === 'TextBox') {
        op = 'ILIKE';
        filterVal = `%${val}%`;
      } else if (Array.isArray(val)) {
        op = 'IN';
        filterVal = val.filter(v => v !== 'ALL_SELECTED');
      } else {
        op = 'IN';
        filterVal = [val];
      }

      const dataMask: DataMask = {
        extraFormData: {
          filters: isEmpty
            ? []
            : [
                {
                  col: filterColumnLabel,
                  op,
                  val: filterVal as any,
                },
              ],
        },
        filterState: {
          value: val,
        },
      };

      setDataMask(dataMask);
    },
    [filterColumnLabel, controlType, setDataMask],
  );

  const handleChange = useCallback(
    (val: unknown) => {
      setLocalValue(val);
      emitFilter(val);
    },
    [emitFilter],
  );

  // Sync external filterState changes (like clearing from filter bar or modal default selection)
  useEffect(() => {
    setLocalValue(filterState?.value);
  }, [filterState?.value]);

  const effectiveControlType =
    typeof controlType === 'string' &&
    ['Dropdown', 'Radio', 'Checkbox', 'TextBox'].includes(controlType)
      ? controlType
      : 'Dropdown';

  const renderControl = () => {
    if (effectiveControlType === 'TextBox') {
      return (
        <Input
          placeholder={`Filter by ${filterColumnLabel || 'value'}`}
          value={localValue as string}
          onChange={e => handleChange(e.target.value)}
          allowClear
          style={{ width: '100%' }}
        />
      );
    }

    // In Filter Bar (where space is tight) or Config Modal, render Checkbox/Radio in compact dropdown
    if (!inCanvas) {
      return (
        <Select
          headerPosition="left"
          ariaLabel={filterColumnLabel || 'Filter'}
          placeholder={`Select ${filterColumnLabel || 'value'}`}
          options={options}
          value={localValue as any}
          onChange={handleChange}
          allowClear
          getPopupContainer={() => document.body}
          mode={
            effectiveControlType === 'Checkbox' || multiSelect
              ? 'multiple'
              : 'single'
          }
        />
      );
    }

    const isExceedingThreshold = options.length > 10;

    // On Canvas (or chart explore), render native full interactive control,
    // or convert to Dropdown if count exceeds 10 options
    if (effectiveControlType === 'Dropdown' || isExceedingThreshold) {
      return (
        <Select
          headerPosition="left"
          ariaLabel={filterColumnLabel || 'Filter'}
          placeholder={`Select ${filterColumnLabel || 'value'}`}
          options={options}
          value={localValue as any}
          onChange={handleChange}
          allowClear
          getPopupContainer={() => document.body}
          mode={
            effectiveControlType === 'Checkbox' || multiSelect
              ? 'multiple'
              : 'single'
          }
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

    if (effectiveControlType === 'Checkbox') {
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
            value={localValue as (string | number)[]}
            onChange={handleChange}
          />
        </div>
      );
    }

    return <div>Unsupported control type</div>;
  };

  return (
    <FilterPluginStyle height={height} width={width}>
      <FormItem validateStatus={filterState?.validateStatus}>
        <Styles inCanvas={inCanvas}>
          {renderControl()}
        </Styles>
      </FormItem>
    </FilterPluginStyle>
  );
}

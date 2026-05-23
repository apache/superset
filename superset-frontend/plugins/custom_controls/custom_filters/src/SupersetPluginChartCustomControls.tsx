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
import React, { useMemo, useState, useRef, useCallback } from 'react';
import { styled } from '@apache-superset/core/theme';
import { DataMask } from '@superset-ui/core';
import { CustomControlsTransformedProps, ExtendedTheme } from './types';
import { Select, Radio, Checkbox, Input } from 'antd';


const Styles = styled.div<{ height: number; width: number }>`
  padding: ${({ theme }: { theme: any }) => (theme as ExtendedTheme).sizeUnit * 2}px;
  width: ${({ width }: { width: number }) => width}px;
  height: ${({ height }: { height: number }) => height}px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;


  /* Force Ant Design components to inherit Superset theme colors for Dark Mode */
  .ant-radio-wrapper,
  .ant-checkbox-wrapper {
    color: ${({ theme }: { theme: any }) => (theme as ExtendedTheme)?.colorText || 'inherit'} !important;
  }
 
  .ant-select-selection-item,
  .ant-select-selection-placeholder {
    color: ${({ theme }: { theme: any }) => (theme as ExtendedTheme)?.colorText || 'inherit'} !important;
  }


  .ant-select:not(.ant-select-customize-input) .ant-select-selector {
    background-color: ${({ theme }: { theme: any }) => (theme as ExtendedTheme)?.colorBgContainer || 'transparent'} !important;
    border-color: ${({ theme }: { theme: any }) => (theme as ExtendedTheme)?.colorBorder || '#d9d9d9'} !important;
    color: ${({ theme }: { theme: any }) => (theme as ExtendedTheme)?.colorText || 'inherit'} !important;
  }


  .ant-select-arrow,
  .ant-select-clear {
    color: ${({ theme }: { theme: any }) => (theme as ExtendedTheme)?.colorText || 'inherit'} !important;
  }


  /* Fix the nested selected tags when mode="multiple" is active */
  .ant-select-multiple .ant-select-selection-item {
    background-color: ${({ theme }: { theme: any }) => (theme as ExtendedTheme)?.colorBgContainer || 'transparent'} !important;
    border-color: ${({ theme }: { theme: any }) => (theme as ExtendedTheme)?.colorBorder || '#d9d9d9'} !important;
    color: ${({ theme }: { theme: any }) => (theme as ExtendedTheme)?.colorText || 'inherit'} !important;
  }


  .ant-select-multiple .ant-select-selection-item-remove {
    color: ${({ theme }: { theme: any }) => (theme as ExtendedTheme)?.colorText || 'inherit'} !important;
  }
`;


export default function SupersetPluginChartCustomControls(props: CustomControlsTransformedProps) {
    const {
        data, height, width, controlType, filterColumn,
        orientation, includeAllOption, multiSelect,
        defaultValue, hideTitle, boldTitle,
        hooks, filterState, theme,
    } = props;
    const { setDataMask = () => { } } = hooks || {};


    // Track whether the user has interacted
    const hasUserInteracted = useRef(false);


    // Extract human-readable string for Custom SQL dimensions
    const filterColumnLabel = useMemo(() => {
        if (!filterColumn) return '';
        if (typeof filterColumn === 'string') return filterColumn;
        return filterColumn.label || filterColumn.column_name || filterColumn.sqlExpression || 'Custom SQL';
    }, [filterColumn]);


    // Get the parsed default value based on control type
    const parsedDefault = useMemo(() => {
        if (!defaultValue) return undefined;


        const isMulti = (controlType === 'Dropdown' && multiSelect) || controlType === 'Checkbox';

        if (isMulti) {
            let vals: (string | number)[] = typeof defaultValue === 'string' && defaultValue.includes(',')
                ? defaultValue.split(',').map(s => s.trim())
                : [defaultValue];


            // Attempt to cast to numeric if the data seems to be numeric
            if (data && data.length > 0 && filterColumnLabel) {
                const firstVal = data[0][filterColumnLabel];
                if (typeof firstVal === 'number') {
                    vals = vals.map(v => {
                        const n = Number(v);
                        return isNaN(n) ? v : n;
                    });
                }
            }
            return vals;
        }


        if (controlType === 'Radio') {
            const val = defaultValue;
            if (data && data.length > 0 && filterColumnLabel) {
                const firstVal = data[0][filterColumnLabel];
                if (typeof firstVal === 'number') {
                    const n = Number(val);
                    return [isNaN(n) ? val : n];
                }
            }
            return [val];
        }


        if (data && data.length > 0 && filterColumnLabel) {
            const firstVal = data[0][filterColumnLabel];
            if (typeof firstVal === 'number') {
                const n = Number(defaultValue);
                return isNaN(n) ? defaultValue : n;
            }
        }


        return defaultValue;
    }, [defaultValue, controlType, multiSelect, data, filterColumnLabel]);


    // Initial local value is filterState if present, else parsedDefault
    const [localValue, setLocalValue] = useState(() => {
        if (filterState?.value !== undefined) {
            return filterState.value;
        }
        return parsedDefault;
    });


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
            value: val
        }));


        if (includeAllOption) {
            opts = [{ label: 'All', value: 'ALL_SELECTED' }, ...opts];
        }


        return opts;
    }, [data, filterColumnLabel, includeAllOption]);


    const emitFilter = useCallback((val: any) => {
        if (!filterColumnLabel) return;


        const isAllSelected = val === 'ALL_SELECTED' || (Array.isArray(val) && val.includes('ALL_SELECTED'));
        const isEmpty = isAllSelected || val === undefined || val === null || val === '' || (Array.isArray(val) && val.length === 0);


        let op: any = '==';
        let filterVal = val;


        if (controlType === 'TextBox') {
            op = 'ILIKE';
            filterVal = `%${val}%`;
        } else if (Array.isArray(val) && multiSelect) {
            op = 'IN';
        }


        const dataMask: DataMask = {
            extraFormData: {
                filters: isEmpty ? [] : [
                    {
                        col: filterColumnLabel,
                        op,
                        val: filterVal,
                    }
                ]
            },
            filterState: {
                value: val,
            },
        };


        setDataMask(dataMask);
    }, [filterColumnLabel, controlType, multiSelect, setDataMask]);


    const handleChange = useCallback((val: any) => {
        hasUserInteracted.current = true;
        setLocalValue(val);
        emitFilter(val);
    }, [emitFilter]);


    // Sync external filterState changes (like clearing from filter bar)
    React.useEffect(() => {
        if (filterState?.value !== undefined) {
            setLocalValue(filterState.value);
            hasUserInteracted.current = true;
        }
    }, [filterState?.value]);


    // Emit the default value on initial load if present and no external filter was already provided
    React.useEffect(() => {
        if (!hasUserInteracted.current && parsedDefault !== undefined && filterState?.value === undefined) {
            // Emitting default as a regular cross filter
            setLocalValue(parsedDefault);
            emitFilter(parsedDefault);
        }
    }, [parsedDefault, filterState?.value, emitFilter]);


    const renderControl = () => {
        if (controlType === 'TextBox') {
            return (
                <Input
                    placeholder={`Filter by ${filterColumnLabel || 'value'}`}
                    value={localValue}
                    onChange={(e) => handleChange(e.target.value)}
                    allowClear
                    style={{ width: '100%' }}
                />
            );
        }


        if (controlType === 'Dropdown') {
            return (
                <Select
                    style={{ width: '100%' }}
                    placeholder={`Select ${filterColumnLabel || 'value'}`}
                    options={options}
                    value={localValue}
                    onChange={handleChange}
                    allowClear
                    mode={multiSelect ? 'multiple' : undefined}
                    dropdownStyle={{ color: theme?.colorText || 'inherit' }}
                />
            );
        }


        const layoutStyle = orientation === 'horizontal'
            ? { display: 'flex', flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: '8px' }
            : { display: 'flex', flexDirection: 'column' as const, gap: '8px' };


        if (controlType === 'Radio') {
            return (
                <Radio.Group
                    style={layoutStyle}
                    value={Array.isArray(localValue) ? localValue[0] : localValue}
                    onChange={(e) => handleChange([e.target.value])}
                >
                    {options.map(opt => (
                        <Radio key={String(opt.value)} value={opt.value}>{opt.label}</Radio>
                    ))}
                </Radio.Group>
            );
        }


        if (controlType === 'Checkbox') {
            return (
                <Checkbox.Group
                    style={layoutStyle}
                    options={options}
                    value={localValue}
                    onChange={handleChange}
                />
            );
        }


        return <div>Unsupported control type</div>;
    };


    const showTitle = !hideTitle && filterColumnLabel;


    return (
        <Styles width={width} height={height} theme={theme}>
            {showTitle && (
                <div style={{
                    marginBottom: '8px',
                    fontWeight: boldTitle ? 'bold' : 'normal',
                }}>
                    {filterColumnLabel}
                </div>
            )}
            {renderControl()}
        </Styles>
    );
}

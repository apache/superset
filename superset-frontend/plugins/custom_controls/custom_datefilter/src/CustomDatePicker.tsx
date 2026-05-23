
import React, { useMemo, useState, useEffect } from 'react';
/* eslint-disable @typescript-eslint/no-unused-vars */
React; // Workaround for TS6133 where TS complains about unused React but Babel/Webpack requires it at runtime
/* eslint-enable @typescript-eslint/no-unused-vars */
import { DataMask } from '@superset-ui/core';
import { styled } from '@apache-superset/core/theme';
import { CustomDatePickerTransformedProps } from './types';
import { DatePicker, ConfigProvider, theme as antdTheme } from 'antd';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';


const { RangePicker } = DatePicker;


// Basic styling envelope for the container
const Styles = styled.div<{ height: number; width: number }>`
  padding: ${({ theme }: { theme: any }) => (theme as any).sizeUnit * 2}px;
  width: ${({ width }: { width: number }) => width}px;
  height: ${({ height }: { height: number }) => height}px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
`;


export default function CustomDatePicker(props: CustomDatePickerTransformedProps) {
    const { height, width, filterColumn, pickerType, showTime, presetRanges, hooks, filterState, theme, defaultType, defaultStaticValue, defaultDynamicValue } = props;
    const { setDataMask = () => { } } = hooks || {};


    const filterColumnLabel = useMemo(() => {
        if (!filterColumn) return '';
        if (typeof filterColumn === 'string') return filterColumn;
        return filterColumn.label || filterColumn.column_name || filterColumn.sqlExpression || 'Custom Date';
    }, [filterColumn]);


    const formatString = showTime ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD';


    // Wrap in useCallback to safely use in effects
    // Emit a single-date filter (DatePicker mode).
    const emitSingleFilter = React.useCallback((dateStr: string | null) => {
        if (!filterColumnLabel) return;
        const isEmpty = !dateStr || dateStr.trim() === '';
        const dataMask: DataMask = {
            extraFormData: {
                filters: isEmpty ? [] : [
                    { col: filterColumnLabel, op: '==', val: dateStr as string },
                ],
            },
            filterState: { value: dateStr },
        };
        setDataMask(dataMask);
    }, [filterColumnLabel, setDataMask]);


    // Emit a range filter (RangePicker mode) as two separate filters (>= start, <= end).
    // BETWEEN was removed from Superset 6.1.0's allowed operator list.
    // Two filters on the same column make filter_values('col') return [startStr, endStr]
    // so Jinja access via [0] and [1] works unchanged.
    const emitRangeFilter = React.useCallback((startStr: string | null, endStr: string | null) => {
        if (!filterColumnLabel) return;
        const isEmpty = !startStr || !endStr;
        const dataMask: DataMask = {
            extraFormData: {
                filters: isEmpty ? [] : [
                    { col: filterColumnLabel, op: '>=', val: startStr as string },
                    { col: filterColumnLabel, op: '<=', val: endStr as string },
                ],
            },
            // filterState keeps the pair as an array so the UI can re-hydrate correctly
            filterState: { value: isEmpty ? null : [startStr as string, endStr as string] },
        };
        setDataMask(dataMask);
    }, [filterColumnLabel, setDataMask]);


    // Use local state for UI syncing with the filterState payload
    const [localValue, setLocalValue] = useState<any>(filterState?.value || null);


    // Initial default evaluation
    useEffect(() => {
        if (filterState?.value) return;


        if (defaultType === 'Static' && defaultStaticValue) {
            if (pickerType === 'RangePicker') {
                // Support both "A and B" and "A,B" separators for static range defaults
                const parts = defaultStaticValue.includes(' and ')
                    ? defaultStaticValue.split(' and ')
                    : defaultStaticValue.split(',').map((s: string) => s.trim());
                if (parts.length === 2) {
                    setLocalValue(parts);
                    emitRangeFilter(parts[0], parts[1]);
                }
            } else {
                setLocalValue(defaultStaticValue);
                emitSingleFilter(defaultStaticValue);
            }
        } else if (defaultType === 'Dynamic' && defaultDynamicValue) {
            const now = dayjs();
            let startDate: Dayjs | null = null;
            let endDate: Dayjs | null = now;
            let singleDateStr: string = now.format(formatString);


            switch (defaultDynamicValue) {
                case 'Today':
                    startDate = now.startOf('day');
                    endDate = now.endOf('day');
                    break;
                case 'Yesterday':
                    startDate = now.subtract(1, 'day').startOf('day');
                    endDate = now.subtract(1, 'day').endOf('day');
                    singleDateStr = startDate.format(formatString);
                    break;
                case 'Last 7 Days':
                    startDate = now.subtract(7, 'day').startOf('day');
                    endDate = now.endOf('day');
                    break;
                case 'Last 30 Days':
                    startDate = now.subtract(30, 'day').startOf('day');
                    endDate = now.endOf('day');
                    break;
                case 'This Month':
                    startDate = now.startOf('month');
                    endDate = now;
                    break;
                case 'This Month (Full)':
                    startDate = now.startOf('month');
                    endDate = now.endOf('month');
                    break;
                case 'Last Month': {
                    const lastMonth = now.subtract(1, 'month');
                    startDate = lastMonth.startOf('month');
                    endDate = lastMonth.endOf('month');
                    break;
                }
                case 'This Year':
                    startDate = now.startOf('year');
                    endDate = now;
                    break;
                default:
                    break;
            }


            if (pickerType === 'RangePicker') {
                if (startDate && endDate) {
                    // Always use string format, never Date objects
                    const startStr = startDate.format(formatString);
                    const endStr = endDate.format(formatString);
                    setLocalValue([startStr, endStr]);
                    emitRangeFilter(startStr, endStr);
                }
            } else {
                setLocalValue(singleDateStr);
                emitSingleFilter(singleDateStr);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Only run once on mount


    // Update from external clears
    useEffect(() => {
        if (filterState?.value !== undefined) {
            setLocalValue(filterState.value);
        }
    }, [filterState?.value]);


    // Event handler for single DatePicker — dateString is always a plain string from antd
    const handleSingleDateChange = (_date: Dayjs | null, dateString: string | string[]) => {
        const strVal = Array.isArray(dateString) ? dateString[0] : dateString;
        setLocalValue(strVal);
        emitSingleFilter(strVal || null);
    };


    // Event handler for RangePicker — dateStrings are always plain strings from antd
    const handleRangeChange = (dates: [Dayjs | null, Dayjs | null] | null, dateStrings: [string, string]) => {
        if (!dates || !dates[0] || !dates[1]) {
            setLocalValue(null);
            emitRangeFilter(null, null);
            return;
        }
        // dateStrings[0] and dateStrings[1] are already formatted strings (YYYY-MM-DD or with time)
        setLocalValue([dateStrings[0], dateStrings[1]]);
        emitRangeFilter(dateStrings[0], dateStrings[1]);
    };


    // Handlers emit appropriately, already handled above since emitFilter is moved


    const presetChoices = useMemo(() => {
        if (!presetRanges) return undefined;
        return [
            { label: 'Today', value: [dayjs().startOf('day'), dayjs().endOf('day')] as [Dayjs, Dayjs] },
            { label: 'Last 7 Days', value: [dayjs().subtract(7, 'd'), dayjs()] as [Dayjs, Dayjs] },
            { label: 'Last 30 Days', value: [dayjs().subtract(30, 'd'), dayjs()] as [Dayjs, Dayjs] },
            { label: 'This Month', value: [dayjs().startOf('month'), dayjs().endOf('month')] as [Dayjs, Dayjs] },
        ];
    }, [presetRanges]);


    // Constructing date instances for the UI components
    let uiValue: any = null;
    if (pickerType === 'DatePicker' && localValue) {
        uiValue = dayjs(localValue, formatString);
    } else if (pickerType === 'RangePicker' && Array.isArray(localValue) && localValue.length === 2) {
        uiValue = [
            localValue[0] ? dayjs(localValue[0], formatString) : null,
            localValue[1] ? dayjs(localValue[1], formatString) : null
        ];
    }


    const { defaultAlgorithm, darkAlgorithm } = antdTheme;
    // Detect dark mode via Ant Design tokens: if background color is dark, use dark algorithm
    const bgColor = (theme as any)?.colorBgContainer || (theme as any)?.colors?.grayscale?.dark1 || '#ffffff';
    const isDarkMode = (() => {
        const hex = bgColor.replace('#', '');
        if (hex.length < 6) return false;
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        return (r * 299 + g * 587 + b * 114) / 1000 < 128;
    })();


    // Cast to any to avoid React types version mismatch between plugin and host
    const ConfigProviderAny = ConfigProvider as any;
    const RangePickerAny = RangePicker as any;


    return (
        <ConfigProviderAny theme={{ algorithm: isDarkMode ? darkAlgorithm : defaultAlgorithm }}>
            <Styles width={width} height={height} theme={theme}>
                {filterColumnLabel && (
                    <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>
                        {filterColumnLabel} Filter
                    </div>
                )}

                {pickerType === 'DatePicker' ? (
                    <DatePicker
                        showTime={showTime}
                        format={formatString}
                        onChange={handleSingleDateChange}
                        value={uiValue}
                        style={{ width: '100%', maxWidth: '300px' }}
                    />
                ) : (
                    <RangePickerAny
                        showTime={showTime}
                        format={formatString}
                        onChange={handleRangeChange}
                        presets={presetChoices}
                        value={uiValue}
                        style={{ width: '100%', maxWidth: '400px' }}
                    />
                )}
            </Styles>
        </ConfigProviderAny>
    );
}


import { ChartProps } from '@superset-ui/core';
import { CustomDatePickerFormData, CustomDatePickerTransformedProps } from '../types';


export default function transformProps(chartProps: ChartProps): CustomDatePickerTransformedProps {
    const { formData, height, width, hooks, queriesData, filterState, theme } = chartProps;


    const { filterColumn, pickerType, showTime, presetRanges, defaultType, defaultStaticValue, defaultDynamicValue } = formData as CustomDatePickerFormData;


    const data = queriesData && queriesData.length > 0 ? queriesData[0].data : [];


    return {
        height,
        width,
        data,
        filterColumn,
        pickerType: pickerType || 'DatePicker',
        showTime: !!showTime,
        presetRanges: !!presetRanges,
        defaultType: defaultType || 'None',
        defaultStaticValue,
        defaultDynamicValue,
        hooks,
        filterState: filterState || { value: null },
        theme,
    };
}



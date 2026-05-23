import { DataRecord, QueryFormData, FilterState } from '@superset-ui/core';


export interface CustomDatePickerFormData extends QueryFormData {
    filterColumn?: any;
    pickerType?: 'DatePicker' | 'RangePicker' | 'Slider';
    showTime?: boolean;
    presetRanges?: boolean;
    defaultType?: 'None' | 'Static' | 'Dynamic';
    defaultStaticValue?: string;
    defaultDynamicValue?: 'Today' | 'Yesterday' | 'Last 7 Days' | 'Last 30 Days' | 'Last Month' | 'This Month' | 'This Year';
}


export type CustomDatePickerTransformedProps = {
    height: number;
    width: number;
    data: DataRecord[];
    filterColumn: any;
    pickerType: 'DatePicker' | 'RangePicker' | 'Slider';
    showTime: boolean;
    presetRanges: boolean;
    defaultType: 'None' | 'Static' | 'Dynamic';
    defaultStaticValue?: string;
    defaultDynamicValue?: string;
    hooks: any;
    filterState: FilterState;
    theme: any;
};

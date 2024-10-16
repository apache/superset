import { SpeedometerTransformProps } from "./types";
import { DataRecord } from '@superset-ui/core';

export default function transformProps(chartProps: SpeedometerTransformProps) {
    const { width, height, formData, queriesData } = chartProps;
    const { metric, minValue, maxValue, thresholdRanges, colorScheme, label, numberFormat, showLabel } = formData;

    const data = queriesData[0].data.map(row => ({
        key: row[metric],
        value: row[metric]
    }))
    return {
        width,
        height,
        data,
        minValue,
        maxValue,
        thresholdRanges,
        colorScheme,
        label,
        numberFormat,
        showLabel,
    };
}
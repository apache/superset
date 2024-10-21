import Metric from "packages/superset-ui-core/src/query/types/Metric";
import { SpeedometerTransformProps } from "./types";
import { DataRecord } from '@superset-ui/core';

const calculatePercentage = (min: number, max: number, value: number): number => {

    if(max === min) {
        return 0;
    }

    let percentage = ((value - min) / (max - min)) * 100;


    return Math.min(Math.max(percentage, 0), 100);
}


export default function transformProps(chartProps: SpeedometerTransformProps) {
    const { width, height, formData, queriesData } = chartProps;
    const { metric } = formData;

    // Ensure there's data
    const data = queriesData[0]?.data || [];

    const metricLabel = metric.label;

    const metricValue = data[0][metricLabel];
    
    // Get min, max, and progress values from the data
    const minValue = 0;
    const maxValue = 10000000;
    const progressValue = data[data.length - 1]?.[metric];

    return {
        width,
        height,
        min: minValue,
        max: maxValue,
        progress: metricValue,
    };
}

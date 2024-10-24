import { DEFAULT_FORM_DATA, SpeedometerTransformProps } from "./types";

const calculatePercentage = (min: number, max: number, value: any): number => {
    if(max === min) {
        return 0;
    }

    let percentage = ((value - min) / (max - min)) * 100;
    
    let final = Math.round(percentage)
    
    return final;
}


export default function transformProps(chartProps: SpeedometerTransformProps) {
    const { width, height, formData, queriesData } = chartProps;
    const { metric } = formData;

    // Ensure there's data
    const data = queriesData[0]?.data || [];
    const metricLabel = metric.label;

    const metricValue = data[0][metricLabel];

    // Get min and max from formData / fall back to defaults
    const minVal = formData.minValue ?? DEFAULT_FORM_DATA.minValue ?? 0;
    const maxVal = formData.maxValue ?? DEFAULT_FORM_DATA.maxValue ?? 100;

    // Calculate actual percentage based on dataset, mn and max values
    const progress = calculatePercentage(minVal, maxVal, metricValue);    

    // Segements 2nd arch
    const segmentAmt = formData.segmentAmt ?? DEFAULT_FORM_DATA.segmentAmt ?? 0;

    return {
        width,
        height,
        min: minVal,
        max: maxVal,
        progress: progress,
        segmentAmt: segmentAmt
    };
}

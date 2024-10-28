import { DEFAULT_FORM_DATA, SpeedometerTransformProps } from "./types";

type RGBA = {r: number, g: number, b: number, a: number };

const calculatePercentage = (min: number, max: number, value: any): number => {
    if(max === min) {
        return 0;
    }

    let percentage = ((value - min) / (max - min)) * 100;
    
    let final = Math.round(percentage)
    
    return final;
}

function rgbaToHex(color: RGBA | string): string {    
    if (typeof color === 'string' && /^#([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})$/.test(color)) {
        return color;
    }

    const {r, g, b, a }= color as RGBA

    const redHex = r.toString(16).padStart(2, '0');
    const greenHex = g.toString(16).padStart(2, '0');
    const blueHex = b.toString(16).padStart(2, '0');
    const alphaHex = (Math.round(a * 255)).toString(16).padStart(2, '0');

    return a === 1 ? `#${redHex}${greenHex}${blueHex}` : `#${redHex}${greenHex}${blueHex}${alphaHex}`;
}

function checkIfStartIsGeaterThanEnd(s1Start: number, s1End: number) {
    var temp = s1Start;
    if(s1Start > s1End) {
        s1Start = s1End;
        s1End = temp      
        return { s1Start, s1End }
    } else {
        return { s1Start, s1End }
    }
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
    const s1ChartColor:any = formData.s1ChartColor ?? DEFAULT_FORM_DATA.s1ChartColor ?? 0;    
    const { s1Start, s1End } = checkIfStartIsGeaterThanEnd( formData.s1Start ?? DEFAULT_FORM_DATA.s1Start ?? 0, formData.s1End ?? DEFAULT_FORM_DATA.s1End ?? 0);

    const convertedColorCode = rgbaToHex(s1ChartColor);

    console.log("s1ChartColor: ", s1ChartColor);
    console.log("convertedColorCode: ", convertedColorCode);
    console.log("Form Data:", formData);
    console.log("Default Form Data:", DEFAULT_FORM_DATA);

    return {
        width,
        height,
        minValue: minVal,
        maxValue: maxVal,
        progress: progress,
        segmentAmt: segmentAmt,
        s1ChartColor: convertedColorCode,
        s1Start: s1Start,
        s1End: s1End,
    };
}

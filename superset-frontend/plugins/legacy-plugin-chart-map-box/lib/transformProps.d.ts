export default function transformProps(chartProps: any): {
    width?: undefined;
    height?: undefined;
    aggregatorName?: undefined;
    bounds?: undefined;
    clusterer?: undefined;
    globalOpacity?: undefined;
    hasCustomMetric?: undefined;
    mapboxApiKey?: undefined;
    mapStyle?: undefined;
    pointRadius?: undefined;
    pointRadiusUnit?: undefined;
    renderWhileDragging?: undefined;
    rgb?: undefined;
} | {
    width: any;
    height: any;
    aggregatorName: any;
    bounds: any;
    clusterer: any;
    globalOpacity: any;
    hasCustomMetric: any;
    mapboxApiKey: any;
    mapStyle: any;
    onViewportChange({ latitude, longitude, zoom }: {
        latitude: any;
        longitude: any;
        zoom: any;
    }): void;
    pointRadius: any;
    pointRadiusUnit: any;
    renderWhileDragging: any;
    rgb: RegExpExecArray;
};
//# sourceMappingURL=transformProps.d.ts.map
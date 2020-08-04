/// <reference types="d3" />

declare interface DataMapOptions {
    element: HTMLElement;
    scope?: string;
    geographyConfig?: DataMapGeographyConfigOptions;
    bubblesConfig?: DataMapBubblesConfigOptions;
    arcConfig?: DataMapArcConfigOptions;
    setProjection?: (element: HTMLElement, options: DataMapOptions) => DataMapProjection;
    fills?: { defaultFill?: string, [key: string]: string };
    done?: (datamap: {
        svg: d3.Selection<any>,
        options: DataMapOptions,
        path: d3.geo.Path;
        projection: d3.geo.Projection;
    }) => void;
    responsive?: boolean;
    projection?: string;
    height?: null | number;
    width?: null | number;
    dataType?: "json" | "csv";
    dataUrl?: null | string;
    data?: any;
    filters?: any;
    aspectRatio?: number;
    projectionConfig?: { rotation: any[] };
}

declare interface DataMapGeographyConfigOptions {
    dataUrl?: null | string;
    hideAntarctica?: boolean;
    hideHawaiiAndAlaska?: boolean;
    borderWidth?: number;
    borderOpacity?: number;
    borderColor?: string;
    popupTemplate?: (geography: DataMapGeographyData, data: any) => string;
    popupOnHover?: boolean;
    highlightOnHover?: boolean;
    highlightFillColor?: string;
    highlightBorderColor?: string;
    highlightBorderWidth?: number;
    highlightBorderOpacity?: number;
}

declare interface DataMapBubblesConfigOptions {
    borderWidth?: number;
    borderOpacity?: number;
    borderColor?: string;
    popupOnHover?: boolean;
    radius?: null | number,
    popupTemplate?: (geography: DataMapGeographyData, data: DataMapBubbleDatum) => string;
    fillOpacity?: number;
    animate?: boolean,
    highlightOnHover?: boolean;
    highlightFillColor?: string;
    highlightBorderColor?: string;
    highlightBorderWidth?: number;
    highlightBorderOpacity?: number;
    highlightFillOpacity?: number;
    exitDelay?: number;
    key?: any; //JSON.stringify
}

declare interface DataMapArcConfigOptions {
    strokeColor?: string;
    strokeWidth?: number;
    arcSharpness?: number;
    animationSpeed?: number;
    popupOnHover?: boolean;
    popupTemplate?: (geography: DataMapGeographyData, data: any) => string;
}

declare interface DataMapGeographyData {
    properties: { name: string };
}

declare interface DataMapProjection {
    path: d3.geo.Path;
    projection: d3.geo.Projection;
}

declare interface DataMapBubbleDatum {
    latitude: number;
    longitude: number;
    radius: number;
    fillKey?: string;
    borderColor?: string;
    borderWidth?: number;
    borderOpacity?: number;
    fillOpacity?: number;
    [key: string]: any;
}

declare interface DataMapLabelOptions {
    labelColor?: string;
    lineWidth?: number;
    fontSize?: number;
    fontFamily?: string;
    customLabelText: any;
}

declare interface DataMapArcDatum {
    origin: string | {
        latitude: number, longitude: number
    };
    destination: string | {
        latitude: number, longitude: number
    };
    options?: {
        strokeWidth?: number;
        strokeColor?: string;
        greatArc?: boolean;
    };
}

declare class DataMap {
    constructor(options: DataMapOptions);
    legend(): void;
    updateChoropleth(data: string | any | null, options?: { reset: boolean, data: any }): void;
    bubbles(data: ReadonlyArray<DataMapBubbleDatum>, opts?: DataMapGeographyConfigOptions): void;
    labels(options?: DataMapLabelOptions): void;
    resize(): void;
    arc(data: ReadonlyArray<DataMapArcDatum>, options?: DataMapArcConfigOptions): void;
    latLngToXY(lat: number, lng: number): any;
    addLayer(className: string, id: string, first: boolean): SVGElement;
    updatePopup(element: HTMLElement, d: DataMapGeographyData, options: DataMapGeographyConfigOptions): string;
    addPlugin(name: string, pluginFn: Function): void;
}

interface JQuery {
    datamaps(options: DataMapOptions): void;
}
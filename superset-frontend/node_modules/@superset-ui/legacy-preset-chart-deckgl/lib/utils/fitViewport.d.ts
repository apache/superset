import { Point } from './types';
declare type Viewport = {
    longtitude: number;
    latitude: number;
    zoom: number;
    bearing?: number;
    pitch?: number;
};
declare type FitViewportOptions = {
    points: Point[];
    width: number;
    height: number;
    minExtent?: number;
    maxZoom?: number;
    offset?: [number, number];
    padding?: number;
};
export default function fitViewport(originalViewPort: Viewport, { points, width, height, minExtent, maxZoom, offset, padding }: FitViewportOptions): any;
export {};
//# sourceMappingURL=fitViewport.d.ts.map
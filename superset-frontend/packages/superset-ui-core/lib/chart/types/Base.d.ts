import { ExtraFormData } from '../../query';
import { JsonObject } from '../..';
export declare type HandlerFunction = (...args: unknown[]) => void;
export declare enum Behavior {
    INTERACTIVE_CHART = "INTERACTIVE_CHART",
    NATIVE_FILTER = "NATIVE_FILTER"
}
export declare enum AppSection {
    EXPLORE = "EXPLORE",
    DASHBOARD = "DASHBOARD",
    FILTER_BAR = "FILTER_BAR",
    FILTER_CONFIG_MODAL = "FILTER_CONFIG_MODAL",
    EMBEDDED = "EMBEDDED"
}
export declare type FilterState = {
    value?: any;
    [key: string]: any;
};
export declare type DataMask = {
    extraFormData?: ExtraFormData;
    filterState?: FilterState;
    ownState?: JsonObject;
};
export declare type SetDataMaskHook = {
    ({ filterState, extraFormData, ownState }: DataMask): void;
};
export interface PlainObject {
    [key: string]: any;
}
declare const _default: {};
export default _default;
//# sourceMappingURL=Base.d.ts.map
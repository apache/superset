import { ChartDataResponse, QueryContext } from '../../types';
export declare const getChartData: {
    (payload: QueryContext, { client }?: import("./types").SupersetApiRequestOptions): Promise<ChartDataResponse>;
    method: string | undefined;
    endpoint: string;
    requestType: "json" | "search" | "form" | "rison";
};
declare const _default: {
    getChartData: {
        (payload: QueryContext, { client }?: import("./types").SupersetApiRequestOptions): Promise<ChartDataResponse>;
        method: string | undefined;
        endpoint: string;
        requestType: "json" | "search" | "form" | "rison";
    };
};
/**
 * All v1 API
 */
export default _default;
//# sourceMappingURL=index.d.ts.map
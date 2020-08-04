/// <reference types="react" />
import { QueryParamConfigMap, DecodedValueMap } from 'serialize-query-params';
import { SetQuery } from './types';
export interface QueryRenderProps<QPCMap extends QueryParamConfigMap> {
    query: DecodedValueMap<QPCMap>;
    setQuery: SetQuery<QPCMap>;
}
export interface QueryParamsProps<QPCMap extends QueryParamConfigMap> {
    config: QPCMap;
    children: (renderProps: QueryRenderProps<QPCMap>) => JSX.Element;
}
export declare const QueryParams: <QPCMap extends QueryParamConfigMap>({ config, children, }: QueryParamsProps<QPCMap>) => JSX.Element;
export default QueryParams;

import * as React from 'react';
import { QueryParamConfigMap, DecodedValueMap } from 'serialize-query-params';
import { SetQuery } from './types';
export interface InjectedQueryProps<QPCMap extends QueryParamConfigMap> {
    query: DecodedValueMap<QPCMap>;
    setQuery: SetQuery<QPCMap>;
}
/**
 * HOC to provide query parameters via props `query` and `setQuery`
 * NOTE: I couldn't get type to automatically infer generic when
 * using the format withQueryParams(config)(component), so I switched
 * to withQueryParams(config, component).
 * See: https://github.com/microsoft/TypeScript/issues/30134
 */
export declare function withQueryParams<QPCMap extends QueryParamConfigMap, P extends InjectedQueryProps<QPCMap>>(paramConfigMap: QPCMap, WrappedComponent: React.ComponentType<P>): React.FunctionComponent<Pick<P, Exclude<keyof P, "query" | "setQuery">>>;
export default withQueryParams;

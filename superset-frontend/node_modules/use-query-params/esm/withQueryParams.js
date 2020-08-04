var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
import * as React from 'react';
import useQueryParams from './useQueryParams';
/**
 * HOC to provide query parameters via props `query` and `setQuery`
 * NOTE: I couldn't get type to automatically infer generic when
 * using the format withQueryParams(config)(component), so I switched
 * to withQueryParams(config, component).
 * See: https://github.com/microsoft/TypeScript/issues/30134
 */
export function withQueryParams(paramConfigMap, WrappedComponent) {
    // return a FC that takes props excluding query and setQuery
    var Component = function (props) {
        var _a = useQueryParams(paramConfigMap), query = _a[0], setQuery = _a[1];
        // see https://github.com/microsoft/TypeScript/issues/28938#issuecomment-450636046 for why `...props as P`
        return (React.createElement(WrappedComponent, __assign({ query: query, setQuery: setQuery }, props)));
    };
    Component.displayName = "withQueryParams(" + (WrappedComponent.displayName ||
        WrappedComponent.name ||
        'Component') + ")";
    return Component;
}
export default withQueryParams;

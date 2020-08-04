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
/**
 * Adapts standard DOM window history to work with our
 * { replace, push } interface.
 *
 * @param history Standard history provided by DOM
 */
function adaptWindowHistory(history) {
    return {
        replace: function (location) {
            history.replaceState(location.state, '', location.protocol + "//" + location.host + location.pathname + location.search);
        },
        push: function (location) {
            history.pushState(location.state, '', location.protocol + "//" + location.host + location.pathname + location.search);
        },
    };
}
/**
 * Adapts @reach/router history to work with our
 * { replace, push } interface.
 *
 * @param history globalHistory from @reach/router
 */
function adaptReachHistory(history) {
    return {
        replace: function (location) {
            history.navigate(location.protocol + "//" + location.host + location.pathname + location.search, { replace: true });
        },
        push: function (location) {
            history.navigate(location.protocol + "//" + location.host + location.pathname + location.search, { replace: false });
        },
    };
}
/**
 * Helper to produce the context value falling back to
 * window history and location if not provided.
 */
function getContextValue(contextValue) {
    if (contextValue === void 0) { contextValue = {}; }
    var value = __assign({}, contextValue);
    var hasWindow = typeof window !== 'undefined';
    if (hasWindow) {
        if (!value.history) {
            value.history = adaptWindowHistory(window.history);
        }
        if (!value.location) {
            value.location = window.location;
        }
    }
    return value;
}
export var QueryParamContext = React.createContext(getContextValue());
/**
 * Context provider for query params to have access to the
 * active routing system, enabling updates to the URL.
 */
export function QueryParamProvider(_a) {
    var children = _a.children, ReactRouterRoute = _a.ReactRouterRoute, reachHistory = _a.reachHistory, history = _a.history, location = _a.location;
    // if we have React Router, use it to get the context value
    if (ReactRouterRoute) {
        return (React.createElement(ReactRouterRoute, null, function (routeProps) {
            return (React.createElement(QueryParamContext.Provider, { value: getContextValue(routeProps) }, children));
        }));
    }
    // if we are using reach router, use its history
    if (reachHistory) {
        return (React.createElement(QueryParamContext.Provider, { value: getContextValue({
                history: adaptReachHistory(reachHistory),
                location: location,
            }) }, children));
    }
    // neither reach nor react-router, so allow manual overrides
    return (React.createElement(QueryParamContext.Provider, { value: getContextValue({ history: history, location: location }) }, children));
}
export default QueryParamProvider;

import * as React from 'react';
import { PushReplaceHistory } from './types';
/**
 * Subset of a @reach/router history object. We only
 * care about the navigate function.
 */
interface ReachHistory {
    navigate: (to: string, options?: {
        state?: any;
        replace?: boolean;
    }) => void;
}
/**
 * Shape of the QueryParamContext, needed to update the URL
 * and know its current state.
 */
export interface QueryParamContextValue {
    history: PushReplaceHistory;
    location: Location;
}
export declare const QueryParamContext: React.Context<QueryParamContextValue>;
/**
 * Props for the Provider component, used to hook the active routing
 * system into our controls.
 */
interface Props {
    /** Main app goes here */
    children: React.ReactNode;
    /** `Route` from react-router */
    ReactRouterRoute?: React.ComponentClass | React.FunctionComponent;
    /** `globalHistory` from @reach/router */
    reachHistory?: ReachHistory;
    /** Manually provided history that meets the { replace, push } interface */
    history?: PushReplaceHistory;
    /**
     * Override location object, otherwise window.location or the
     * location provided by the active routing system is used.
     */
    location?: Location;
}
/**
 * Context provider for query params to have access to the
 * active routing system, enabling updates to the URL.
 */
export declare function QueryParamProvider({ children, ReactRouterRoute, reachHistory, history, location, }: Props): JSX.Element;
export default QueryParamProvider;

declare module 'redux-undo' {
  import { Reducer, Action } from 'redux';

  export interface StateWithHistory<State> {
    past: State[];
    present: State;
    future: State[];
    _latestUnfiltered: State;
    group: any;
    index: number;
    limit: number;
  }

  export type FilterFunction = <State>(action: Action, currentState: State, previousHistory: StateWithHistory<State>) => boolean;
  export type GroupByFunction = <State>(action: Action, currentState: State, previousHistory: StateWithHistory<State>) => any;
  export type CombineFilters = (...filters: FilterFunction[]) => FilterFunction;

  export class ActionCreators {
    static undo: () => Action;
    static redo: () => Action;
    static jump: (point: number) => Action;
    static jumpToPast: (index: number) => Action;
    static jumpToFuture: (index: number) => Action;
    static clearHistory: () => Action;
  }

  export class ActionTypes {
    static UNDO: string;
    static REDO: string;
    static JUMP: string;
    static JUMP_TO_PAST: string;
    static JUMP_TO_FUTURE: string;
    static CLEAR_HISTORY: string;
  }

  export interface UndoableOptions {
    /* Set a limit for the history */
    limit?: number;

    /** If you don't want to include every action in the undo/redo history, you can add a filter function to undoable */
    filter?: FilterFunction;

    /** Groups actions together into one undo step */
    groupBy?: GroupByFunction;

    /** Define a custom action type for this undo action */
    undoType?: string;
    /** Define a custom action type for this redo action */
    redoType?: string;

    /** Define custom action type for this jump action */
    jumpType?: string;

    /** Define custom action type for this jumpToPast action */
    jumpToPastType?: string;
    /** Define custom action type for this jumpToFuture action */
    jumpToFutureType?: string;

    /** [beta only] Define custom action type for this clearHistory action */
    clearHistoryType?: string;

    /** History will be (re)set upon init action type */
    initTypes?: string[];

    /** Set to `true` to turn on debugging */
    debug?: boolean;

    /** Set to `true` to prevent undoable from skipping the reducer on undo/redo **/
    neverSkipReducer?: boolean;

    /** Set to `true` to prevent the user from undoing to the initial state  **/
    ignoreInitialState?: boolean;

    /** Set to `true` to synchronize the _latestUnfiltered state with present wen a excluded action is dispatched **/
    syncFilter?: boolean;
  }

  interface Undoable {
    <State>(reducer: Reducer<State>, options?: UndoableOptions): Reducer<StateWithHistory<State>>;
  }


  type IncludeAction = (actions: string | string[]) => FilterFunction;
  type ExcludeAction = IncludeAction;
  type GroupByActionTypes = (actions: string | string[]) => GroupByFunction;

  const undoable: Undoable;

  export default undoable;

  /**
   * If you don't want to include every action in the undo/redo history, you can add a filter function to undoable.
   * redux-undo provides you with the includeAction and excludeAction helpers for basic filtering.
   */
  export const includeAction: IncludeAction;

  /**
   * If you don't want to include every action in the undo/redo history, you can add a filter function to undoable.
   * redux-undo provides you with the includeAction and excludeAction helpers for basic filtering.
   */
  export const excludeAction: ExcludeAction;

  export const combineFilters: CombineFilters;

  export const groupByActionTypes: GroupByActionTypes;

}

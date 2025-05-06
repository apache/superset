import type { QueryAdhocState } from './types';

const initialState: QueryAdhocState = {
  isLoading: null,
  sql: null,
  queryResult: null,
  error: null,
};

export default function databaseReducer(
  state: QueryAdhocState = initialState,
  action: any,
): QueryAdhocState {
  switch (action.type) {
    case 'SET_QUERY_IS_LOADING':
      return {
        ...state,
        isLoading: action.payload,
      };
    case 'SET_QUERY_RESULT':
      return {
        ...state,
        sql: action.payload.query.sql ?? '',
        queryResult: action.payload,
        error: null,
      };
    case 'SET_QUERY_ERROR':
      return {
        ...initialState,
        error: action.payload,
      };
    case 'RESET_DATABASE_STATE':
      return initialState;
    default:
      return state;
  }
}

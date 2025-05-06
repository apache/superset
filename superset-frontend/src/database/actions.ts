import { makeApi } from '@superset-ui/core';
import { ThunkDispatch } from 'redux-thunk';
import { AnyAction } from 'redux';
import { QueryExecutePayload, QueryExecuteResponse } from './types';

export const executeQueryApi = makeApi<
  QueryExecutePayload,
  QueryExecuteResponse
>({
  method: 'POST',
  endpoint: '/api/v1/sqllab/execute',
});

export function setQueryIsLoading(isLoading: boolean) {
  return {
    type: 'SET_QUERY_IS_LOADING',
    payload: isLoading,
  };
}
export function setQueryResult(queryResult: QueryExecuteResponse) {
  return {
    type: 'SET_QUERY_RESULT',
    payload: queryResult,
  };
}
export function resetDatabaseState() {
  return {
    type: 'RESET_DATABASE_STATE',
  };
}
export function setQueryError(error: string) {
  return {
    type: 'SET_QUERY_ERROR',
    payload: error,
  };
}
export function executeQuery(payload: QueryExecutePayload) {
  return async function (dispatch: ThunkDispatch<any, undefined, AnyAction>) {
    try {
      dispatch(setQueryIsLoading(true));
      const result = await executeQueryApi(payload);
      dispatch(setQueryResult(result as QueryExecuteResponse));
    } catch (error) {
      dispatch(setQueryError(error.message));
    } finally {
      dispatch(setQueryIsLoading(false));
    }
  };
}

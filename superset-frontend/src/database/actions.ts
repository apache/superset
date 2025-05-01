import {  makeApi } from "@superset-ui/core";
import { QueryExecutePayload, QueryExecuteResponse } from "./types";
import { ThunkDispatch } from "redux-thunk";
import { AnyAction } from "redux";

export const executeQueryApi = makeApi<QueryExecutePayload, QueryExecuteResponse>(
    {
        method: 'POST',
        endpoint: '/api/v1/database/sql_query/execute',
    },
);

export function setQueryIsLoading(isLoading: boolean) {
    return {
        type: 'SET_QUERY_IS_LOADING',
        payload: isLoading,
    }
}
export function setQueryResult(queryResult: QueryExecuteResponse) {
    return { 
        type: 'SET_QUERY_RESULT',
        payload: queryResult,
    }   
}
export function resetDatabaseState() { 
    return {
        type: 'RESET_DATABASE_STATE',
    }   
}
export function executeQuery(payload: QueryExecutePayload) {
    return async function (dispatch: ThunkDispatch<any, undefined, AnyAction>) {
        try {
            dispatch(setQueryIsLoading(true));
            const result = await executeQueryApi(payload)
            dispatch(setQueryResult(result as QueryExecuteResponse))
        }catch(error){
            //TODO handle error and show feedback to user
            console.error('Error executing query', error);
        }finally{
            dispatch(setQueryIsLoading(false))
        }
    }
}

export const databaseActions = {
    setQueryIsLoading,
    setQueryResult,
    executeQuery,
    resetDatabaseState
}

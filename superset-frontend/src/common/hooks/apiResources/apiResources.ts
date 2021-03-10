/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { makeApi, JsonObject } from '@superset-ui/core';
import { Dispatch } from 'redux';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { v1 as uuidv1 } from 'uuid';

export enum ResourceStatus {
  LOADING = 'loading',
  COMPLETE = 'complete',
  ERROR = 'error',
}

/**
 * An object containing the data fetched from the API,
 * as well as loading and error info
 */
export type Resource<T> = LoadingState | CompleteState<T> | ErrorState;
export type ResourcesState = Record<string, Resource<any>>;
export const initialResourcesState: ResourcesState = {};

// Trying out something a little different: a separate type per status.
// This should let Typescript know whether a Resource has a result or error.
// It's possible that I'm expecting too much from Typescript here.
// If this ends up causing problems, we can change the type to:
//
// export type Resource<T> = {
//   status: ResourceStatus;
//   result: null | T;
//   error: null | Error;
// }

type LoadingState = {
  status: ResourceStatus.LOADING;
  result: null;
  error: null;
};

type CompleteState<T> = {
  status: ResourceStatus.COMPLETE;
  result: T;
  error: null;
};

type ErrorState = {
  status: ResourceStatus.ERROR;
  result: null;
  error: Error;
};

const initialState: LoadingState = {
  status: ResourceStatus.LOADING,
  result: null,
  error: null,
};

const RESOURCE_START = 'RESOURCE_START';
const RESOURCE_SUCCESS = 'RESOURCE_SUCCESS';
const RESOURCE_ERROR = 'RESOURCE_FETCH_ERROR';

type FetchStart = {
  type: typeof RESOURCE_START;
  clientId: string;
};

type FetchSuccess<T = any> = {
  type: typeof RESOURCE_SUCCESS;
  clientId: string;
  result: T;
};

type FetchError = {
  type: typeof RESOURCE_ERROR;
  clientId: string;
  error: Error;
};

type ResourceAction = FetchStart | FetchSuccess | FetchError;

export function resourcesReducer(
  state: ResourcesState = initialResourcesState,
  action: ResourceAction,
): ResourcesState {
  switch (action.type) {
    case RESOURCE_START: {
      return {
        ...state,
        [action.clientId]: {
          status: ResourceStatus.LOADING,
          result: null,
          error: null,
        },
      };
    }
    case RESOURCE_SUCCESS: {
      const { clientId, result } = action;
      return {
        ...state,
        [clientId]: {
          status: ResourceStatus.COMPLETE,
          result,
          error: null,
        },
      };
    }
    case RESOURCE_ERROR: {
      const { clientId, error } = action as FetchError;
      return {
        ...state,
        [clientId]: {
          status: ResourceStatus.ERROR,
          result: null,
          error,
        },
      };
    }
    default:
      return state;
  }
}

type ReduxRootState = { apiResources: ResourcesState };
const selectResource = <RESULT>(clientId: string) => (
  state: ReduxRootState,
): Resource<RESULT> | null => state.apiResources[clientId] ?? null;

async function fetchData<RESULT>(
  dispatch: Dispatch<ResourceAction>,
  endpoint: string,
) {
  const clientId = uuidv1();

  dispatch({
    type: RESOURCE_START,
    clientId,
  });

  const fetchResource = makeApi<{}, RESULT>({
    method: 'GET',
    endpoint,
  });

  try {
    const result = await fetchResource({});
    dispatch({
      type: RESOURCE_SUCCESS,
      clientId,
      result,
    });
  } catch (error) {
    dispatch({
      type: RESOURCE_ERROR,
      clientId,
      error,
    });
  }
}

export function useApiFetch<RESULT>(endpoint: string): void {
  const dispatch = useDispatch<Dispatch<ResourceAction>>();
  const resource = useSelector(selectResource(endpoint));

  useEffect(() => {
    if (resource != null) {
      // fetching already underway/complete, don't duplicate work.
      return;
    }

    fetchData<RESULT>(dispatch, endpoint);
  }, [endpoint, resource, dispatch]);
}

export function useApiFetchWithStore(endpoint: string) {
  const dispatch = useDispatch<Dispatch<ResourceAction>>();
  return async function callResource() {
    const response = await fetchData(dispatch, endpoint);
  };
}

export function useApiUpdate<APIPayload>(
  endpoint: string,
): (data: JsonObject) => Promise<any> {
  const dispatch = useDispatch<Dispatch<ResourceAction>>();

  return async function callResource(data: APIPayload) {
    const clientId = uuidv1();
    dispatch({
      type: RESOURCE_START,
      clientId,
    });

    const updateResource = makeApi<JsonObject, {}>({
      method: 'PUT',
      endpoint,
    });

    try {
      const result = await updateResource(data);
      dispatch({
        type: RESOURCE_SUCCESS,
        clientId,
        result,
      });
    } catch (error) {
      dispatch({
        type: RESOURCE_ERROR,
        clientId,
        error,
      });
    }
  };
}

/**
 * A general-purpose hook to fetch the response from an endpoint.
 * Returns the full response body from the API, including metadata.
 *
 * Note: You likely want {useApiV1Resource} instead of this!
 *
 * TODO Store the state in redux or something, share state between hook instances.
 *
 * TODO Include a function in the returned resource object to refresh the data.
 *
 * A core design decision here is composition > configuration,
 * and every hook should only have one job.
 * Please address new needs with new hooks if possible,
 * rather than adding config options to this hook.
 *
 * @param endpoint The url where the resource is located.
 */
export function useApiResourceFullBody<RESULT>(
  endpoint: string,
): Resource<RESULT> {
  const [resource, setResource] = useState<Resource<RESULT>>(initialState);
  const cancelRef = useRef<() => void>(() => {});

  useEffect(() => {
    // If refresh is implemented, this will need to change.
    // The previous values should stay during refresh.
    setResource(initialState);

    // when this effect runs, the endpoint has changed.
    // cancel any current calls so that state doesn't get messed up.
    cancelRef.current();
    let cancelled = false;
    cancelRef.current = () => {
      cancelled = true;
    };

    const fetchResource = makeApi<{}, RESULT>({
      method: 'GET',
      endpoint,
    });

    fetchResource({})
      .then(result => {
        if (!cancelled) {
          setResource({
            status: ResourceStatus.COMPLETE,
            result,
            error: null,
          });
        }
      })
      .catch(error => {
        if (!cancelled) {
          setResource({
            status: ResourceStatus.ERROR,
            result: null,
            error,
          });
        }
      });

    // Cancel the request when the component un-mounts
    return () => {
      cancelled = true;
    };
  }, [endpoint]);

  return resource;
}

/**
 * For when you want to transform the result of an api resource hook before using it.
 *
 * @param resource the Resource object returned from useApiV1Resource
 * @param transformFn a callback that transforms the result object into the shape you want.
 * Make sure to use a persistent function for this so it doesn't constantly recalculate!
 */
export function useTransformedResource<IN, OUT>(
  resource: Resource<IN>,
  transformFn: (result: IN) => OUT,
): Resource<OUT> {
  return useMemo(() => {
    if (resource.status !== ResourceStatus.COMPLETE) {
      // While incomplete, there is no result - no need to transform.
      return resource;
    }
    return {
      ...resource,
      result: transformFn(resource.result),
    };
  }, [resource, transformFn]);
}

// returns the "result" field from a fetched API v1 endpoint
const extractInnerResult = <T>(responseBody: { result: T }) =>
  responseBody.result;

/**
 * A general-purpose hook to fetch a Superset resource from a v1 API endpoint.
 * Handles request lifecycle and async logic so you don't have to.
 *
 * This returns the data under the "result" field in the API response body.
 * If you need the full response body, use {useFullApiResource} instead.
 *
 * @param endpoint The url where the resource is located.
 */
export function useApiV1Resource<RESULT>(endpoint: string): Resource<RESULT> {
  return useTransformedResource(
    useApiResourceFullBody<{ result: RESULT }>(endpoint),
    extractInnerResult,
  );
}

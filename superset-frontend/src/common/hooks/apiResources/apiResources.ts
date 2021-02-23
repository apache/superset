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

import { createContext, useEffect, useMemo, useRef, useState } from 'react';
import { Action, Dispatch } from 'redux';
import { makeApi } from '@superset-ui/core';
import { useDispatch, useSelector } from 'react-redux';

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

export type ReduxState = {
  [url: string]: Resource<any>;
};

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

const loadingState: LoadingState = {
  status: ResourceStatus.LOADING,
  result: null,
  error: null,
};

const RESOURCE_FETCH_START = 'RESOURCE_FETCH_START';
const RESOURCE_FETCH_COMPLETE = 'RESOURCE_FETCH_COMPLETE';
const RESOURCE_FETCH_ERROR = 'RESROUCE_FETCH_ERROR';

type FetchStart = {
  type: typeof RESOURCE_FETCH_START;
  endpoint: string;
};

type FetchComplete<T = any> = {
  type: typeof RESOURCE_FETCH_COMPLETE;
  endpoint: string;
  result: T;
};

type FetchError = {
  type: typeof RESOURCE_FETCH_ERROR;
  endpoint: string;
  error: Error;
};

type ResourceAction = FetchStart | FetchComplete | FetchError;

export type ResourcesState = Record<string, Resource<any>>;

export const initialResourcesState: ResourcesState = {};

export function resourcesReducer(
  state: ResourcesState = initialResourcesState,
  action: ResourceAction,
): ResourcesState {
  switch (action.type) {
    case RESOURCE_FETCH_START: {
      return {
        ...state,
        [action.endpoint]: {
          status: ResourceStatus.LOADING,
          result: null,
          error: null,
        },
      };
    }
    case RESOURCE_FETCH_COMPLETE: {
      const { endpoint, result } = action;
      return {
        ...state,
        [endpoint]: {
          status: ResourceStatus.COMPLETE,
          result,
          error: null,
        },
      };
    }
    case RESOURCE_FETCH_ERROR: {
      const { endpoint, error } = action as FetchError;
      return {
        ...state,
        [endpoint]: {
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

const selectResourceForEndpoint = <RESULT>(endpoint: string) => (
  state: ReduxRootState,
): Resource<RESULT> | null => state.apiResources[endpoint] ?? null;

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
  const dispatch = useDispatch<Dispatch<ResourceAction>>();
  const resource = useSelector(selectResourceForEndpoint<RESULT>(endpoint));

  useEffect(() => {
    if (resource != null) {
      // fetching already underway/complete, don't duplicate work.
      return;
    }

    dispatch({
      type: RESOURCE_FETCH_START,
      endpoint,
    });

    const fetchResource = makeApi<{}, RESULT>({
      method: 'GET',
      endpoint,
    });

    fetchResource({})
      .then(result => {
        dispatch({
          type: RESOURCE_FETCH_COMPLETE,
          endpoint,
          result,
        });
      })
      .catch(error => {
        dispatch({
          type: RESOURCE_FETCH_ERROR,
          endpoint,
          error,
        });
      });
  }, [endpoint, resource, dispatch]);

  return resource ?? loadingState;
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

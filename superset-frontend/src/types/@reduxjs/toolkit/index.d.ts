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
declare module '@reduxjs/toolkit' {
  import type {
    AnyAction,
    Middleware,
    Reducer,
    ReducersMapObject,
    Store,
    StoreEnhancer,
  } from 'redux';
  import type { createSelector as createReselectSelector } from 'reselect';

  export { Store, StoreEnhancer };

  export type ConfigureStoreOptions = {
    reducer?: Reducer | ReducersMapObject;
    preloadedState?: unknown;
    middleware?: (
      getDefaultMiddleware: (options?: unknown) => Middleware[],
    ) => Middleware[];
    devTools?: boolean;
    enhancers?: StoreEnhancer[];
  };

  export type AnyListenerPredicate<S = unknown> = (
    action: AnyAction,
    currentState: S,
    previousState: S,
  ) => boolean;

  export function configureStore(options: ConfigureStoreOptions): Store;
  export function createListenerMiddleware(): {
    middleware: Middleware;
    startListening(options: {
      predicate: AnyListenerPredicate;
      effect: (action: AnyAction, api: unknown) => void;
    }): () => void;
  };
  export const createSelector: typeof createReselectSelector;
}

declare module '@reduxjs/toolkit/query/react' {
  import type { AnyAction, Middleware, Reducer } from 'redux';

  export type BaseQueryApi = {
    signal: AbortSignal;
  };

  export type QueryReturnValue<Result = unknown, Error = unknown> = {
    data?: Result;
    error?: Error;
  };

  export type BaseQueryFn<
    Args = unknown,
    Result = unknown,
    Error = unknown,
  > = (
    args: Args,
    api: BaseQueryApi,
    extraOptions?: unknown,
  ) => Promise<QueryReturnValue<Result, Error>> | QueryReturnValue<Result, Error>;

  export type EndpointBuilder = {
    query<Result = unknown, Arg = unknown>(config: unknown): unknown;
    mutation<Result = unknown, Arg = unknown>(config: unknown): unknown;
  };

  export type ApiConfig = {
    reducerPath: string;
    tagTypes?: string[];
    endpoints: (builder: EndpointBuilder) => unknown;
    baseQuery?: unknown;
  };

  export type ApiInstance = {
    reducerPath: string;
    reducer: Reducer<unknown, AnyAction>;
    middleware: Middleware;
    util: any;
    endpoints: Record<string, any>;
    injectEndpoints(config: {
      endpoints: (builder: EndpointBuilder) => unknown;
    }): any;
  };

  export const skipToken: symbol;
  export function createApi(config: ApiConfig): ApiInstance;
}

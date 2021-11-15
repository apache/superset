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
import '@testing-library/jest-dom/extend-expect';
import React, { ReactNode, ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { ThemeProvider, supersetTheme } from '@superset-ui/core';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { combineReducers, createStore, applyMiddleware, compose } from 'redux';
import thunk from 'redux-thunk';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import reducerIndex from 'spec/helpers/reducerIndex';
import { QueryParamProvider } from 'use-query-params';

type Options = Omit<RenderOptions, 'queries'> & {
  useRedux?: boolean;
  useDnd?: boolean;
  useQueryParams?: boolean;
  useRouter?: boolean;
  initialState?: {};
  reducers?: {};
};

function createWrapper(options?: Options) {
  const {
    useDnd,
    useRedux,
    useQueryParams,
    useRouter,
    initialState,
    reducers,
  } = options || {};

  return ({ children }: { children?: ReactNode }) => {
    let result = (
      <ThemeProvider theme={supersetTheme}>{children}</ThemeProvider>
    );

    if (useDnd) {
      result = <DndProvider backend={HTML5Backend}>{result}</DndProvider>;
    }

    if (useRedux) {
      const store = createStore(
        combineReducers(reducers || reducerIndex),
        initialState || {},
        compose(applyMiddleware(thunk)),
      );

      result = <Provider store={store}>{result}</Provider>;
    }

    if (useQueryParams) {
      result = <QueryParamProvider>{result}</QueryParamProvider>;
    }

    if (useRouter) {
      result = <BrowserRouter>{result}</BrowserRouter>;
    }

    return result;
  };
}

const customRender = (ui: ReactElement, options?: Options) =>
  render(ui, { wrapper: createWrapper(options), ...options });

export function sleep(time: number) {
  return new Promise(resolve => {
    setTimeout(resolve, time);
  });
}

export * from '@testing-library/react';
export { customRender as render };

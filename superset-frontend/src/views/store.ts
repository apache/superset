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
import {
  configureStore,
  ConfigureStoreOptions,
  StoreEnhancer,
} from '@reduxjs/toolkit';
import thunk from 'redux-thunk';
import { api } from 'src/hooks/apiResources/queryApi';
import messageToastReducer from 'src/components/MessageToasts/reducers';
import charts from 'src/components/Chart/chartReducer';
import dataMask from 'src/dataMask/reducer';
import reports from 'src/features/reports/ReportModal/reducer';
import dashboardInfo from 'src/dashboard/reducers/dashboardInfo';
import dashboardState from 'src/dashboard/reducers/dashboardState';
import dashboardFilters from 'src/dashboard/reducers/dashboardFilters';
import nativeFilters from 'src/dashboard/reducers/nativeFilters';
import dashboardDatasources from 'src/dashboard/reducers/datasources';
import sliceEntities from 'src/dashboard/reducers/sliceEntities';
import dashboardLayout from 'src/dashboard/reducers/undoableDashboardLayout';
import logger from 'src/middleware/loggerMiddleware';
import saveModal from 'src/explore/reducers/saveModalReducer';
import explore from 'src/explore/reducers/exploreReducer';
import exploreDatasources from 'src/explore/reducers/datasourcesReducer';

import { persistSqlLabStateEnhancer } from 'src/SqlLab/middlewares/persistSqlLabStateEnhancer';
import sqlLabReducer from 'src/SqlLab/reducers/sqlLab';
import getInitialState from 'src/SqlLab/reducers/getInitialState';
import { DatasourcesState } from 'src/dashboard/types';
import {
  DatasourcesActionPayload,
  DatasourcesAction,
} from 'src/dashboard/actions/datasources';
import { nanoid } from 'nanoid';
import {
  BootstrapUser,
  UndefinedUser,
  UserWithPermissionsAndRoles,
} from 'src/types/bootstrapTypes';
import { AnyDatasourcesAction } from 'src/explore/actions/datasourcesActions';
import { HydrateExplore } from 'src/explore/actions/hydrateExplore';
import getBootstrapData from 'src/utils/getBootstrapData';
import { Dataset } from '@superset-ui/chart-controls';

// Some reducers don't do anything, and redux is just used to reference the initial "state".
// This may change later, as the client application takes on more responsibilities.
const noopReducer =
  <STATE = unknown>(initialState: STATE) =>
  (state: STATE = initialState) =>
    state;

const bootstrapData = getBootstrapData();

export const USER_LOADED = 'USER_LOADED';

export type UserLoadedAction = {
  type: typeof USER_LOADED;
  user: UserWithPermissionsAndRoles;
};

export const userReducer = (
  user = bootstrapData.user || {},
  action: UserLoadedAction,
): BootstrapUser | UndefinedUser => {
  if (action.type === USER_LOADED) {
    return action.user;
  }
  return user;
};

const getMiddleware: ConfigureStoreOptions['middleware'] =
  getDefaultMiddleware =>
    process.env.REDUX_DEFAULT_MIDDLEWARE
      ? getDefaultMiddleware({
          immutableCheck: {
            warnAfter: 200,
          },
          serializableCheck: {
            // Ignores AbortController instances
            ignoredActionPaths: [/queryController/g],
            ignoredPaths: [/queryController/g],
            warnAfter: 200,
          },
        }).concat(logger, api.middleware)
      : [thunk, logger, api.middleware];

// TODO: This reducer is a combination of the Dashboard and Explore reducers.
// The correct way of handling this is to unify the actions and reducers from both
// modules in shared files. This involves a big refactor to unify the parameter types
// and move files around. We should tackle this in a specific PR.
const CombinedDatasourceReducers = (
  datasources: DatasourcesState | undefined | { [key: string]: Dataset },
  action: DatasourcesActionPayload | AnyDatasourcesAction | HydrateExplore,
) => {
  if (action.type === DatasourcesAction.SetDatasources) {
    return dashboardDatasources(
      datasources as DatasourcesState | undefined,
      action as DatasourcesActionPayload,
    );
  }
  return exploreDatasources(
    datasources as { [key: string]: Dataset },
    action as AnyDatasourcesAction | HydrateExplore,
  );
};

const reducers = {
  sqlLab: sqlLabReducer,
  localStorageUsageInKilobytes: noopReducer(0),
  messageToasts: messageToastReducer,
  common: noopReducer(bootstrapData.common),
  user: userReducer,
  impressionId: noopReducer(nanoid()),
  charts,
  datasources: CombinedDatasourceReducers,
  dashboardInfo,
  dashboardFilters,
  dataMask,
  nativeFilters,
  dashboardState,
  dashboardLayout,
  sliceEntities,
  reports,
  saveModal,
  explore,
};

/* In some cases the jinja template injects two seperate React apps into basic.html
 * One for the top navigation Menu and one for the application below the Menu
 * The first app to connect to the Redux debugger wins which is the menu blocking
 * the application from being able to connect to the redux debugger.
 * setupStore with disableDebugger true enables the menu.tsx component to avoid connecting
 * to redux debugger so the application can connect to redux debugger
 */
export function setupStore({
  disableDebugger = false,
  initialState = getInitialState(bootstrapData),
  rootReducers = reducers,
  ...overrides
}: {
  disableDebugger?: boolean;
  initialState?: ConfigureStoreOptions['preloadedState'];
  rootReducers?: ConfigureStoreOptions['reducer'];
} & Partial<ConfigureStoreOptions> = {}) {
  return configureStore({
    preloadedState: initialState,
    reducer: {
      [api.reducerPath]: api.reducer,
      ...rootReducers,
    },
    middleware: getMiddleware,
    devTools: process.env.WEBPACK_MODE === 'development' && !disableDebugger,
    enhancers: [persistSqlLabStateEnhancer as StoreEnhancer],
    ...overrides,
  });
}

export const store = setupStore();
export type RootState = ReturnType<typeof store.getState>;

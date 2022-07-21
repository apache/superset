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
  applyMiddleware,
  combineReducers,
  compose,
  createStore,
  Store,
} from 'redux';
import thunk from 'redux-thunk';
import messageToastReducer from 'src/components/MessageToasts/reducers';
import { initEnhancer } from 'src/reduxUtils';
import charts from 'src/components/Chart/chartReducer';
import dataMask from 'src/dataMask/reducer';
import reports from 'src/reports/reducers/reports';
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
import { DatasourcesState } from 'src/dashboard/types';
import {
  DatasourcesActionPayload,
  DatasourcesAction,
} from 'src/dashboard/actions/datasources';
import shortid from 'shortid';
import {
  BootstrapUser,
  UserWithPermissionsAndRoles,
} from 'src/types/bootstrapTypes';
import { AnyDatasourcesAction } from 'src/explore/actions/datasourcesActions';
import { HydrateExplore } from 'src/explore/actions/hydrateExplore';
import { Dataset } from '@superset-ui/chart-controls';

// Some reducers don't do anything, and redux is just used to reference the initial "state".
// This may change later, as the client application takes on more responsibilities.
const noopReducer =
  <STATE = unknown>(initialState: STATE) =>
  (state: STATE = initialState) =>
    state;

const container = document.getElementById('app');
const bootstrap = JSON.parse(container?.getAttribute('data-bootstrap') ?? '{}');

export const USER_LOADED = 'USER_LOADED';

export type UserLoadedAction = {
  type: typeof USER_LOADED;
  user: UserWithPermissionsAndRoles;
};

const userReducer = (
  user: BootstrapUser = bootstrap.user || {},
  action: UserLoadedAction,
): BootstrapUser => {
  if (action.type === USER_LOADED) {
    return action.user;
  }
  return user;
};

// TODO: This reducer is a combination of the Dashboard and Explore reducers.
// The correct way of handling this is to unify the actions and reducers from both
// modules in shared files. This involves a big refactor to unify the parameter types
// and move files around. We should tackle this in a specific PR.
const CombinedDatasourceReducers = (
  datasources: DatasourcesState | undefined | { [key: string]: Dataset },
  action: DatasourcesActionPayload | AnyDatasourcesAction | HydrateExplore,
) => {
  if (action.type === DatasourcesAction.SET_DATASOURCES) {
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

// exported for tests
export const rootReducer = combineReducers({
  messageToasts: messageToastReducer,
  common: noopReducer(bootstrap.common || {}),
  user: userReducer,
  impressionId: noopReducer(shortid.generate()),
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
});

export const store: Store = createStore(
  rootReducer,
  {},
  compose(applyMiddleware(thunk, logger), initEnhancer(false)),
);

/* In some cases the jinja template injects two seperate React apps into basic.html
 * One for the top navigation Menu and one for the application below the Menu
 * The first app to connect to the Redux debugger wins which is the menu blocking
 * the application from being able to connect to the redux debugger.
 * setupStore with disableDebugger true enables the menu.tsx component to avoid connecting
 * to redux debugger so the application can connect to redux debugger
 */
export function setupStore(disableDegugger = false): Store {
  return createStore(
    rootReducer,
    {},
    compose(
      applyMiddleware(thunk, logger),
      initEnhancer(false, undefined, disableDegugger),
    ),
  );
}

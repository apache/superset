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

import { FeatureFlag, isFeatureEnabled } from '@superset-ui/core';
import {
  lazy,
  ComponentType,
  ComponentProps,
  LazyExoticComponent,
} from 'react';
import { isUserAdmin } from 'src/dashboard/util/permissionUtils';
import getBootstrapData from 'src/utils/getBootstrapData';
import { RoutePaths } from './routePaths';

// not lazy loaded since this is the home page.
import Home from 'src/pages/Home';

const ChartCreation = lazy(
  () =>
    import(/* webpackChunkName: "ChartCreation" */ 'src/pages/ChartCreation'),
);

const AnnotationLayerList = lazy(
  () =>
    import(
      /* webpackChunkName: "AnnotationLayerList" */ 'src/pages/AnnotationLayerList'
    ),
);

const AlertReportList = lazy(
  () =>
    import(
      /* webpackChunkName: "AlertReportList" */ 'src/pages/AlertReportList'
    ),
);

const AnnotationList = lazy(
  () =>
    import(/* webpackChunkName: "AnnotationList" */ 'src/pages/AnnotationList'),
);

const ChartList = lazy(
  () => import(/* webpackChunkName: "ChartList" */ 'src/pages/ChartList'),
);

const CssTemplateList = lazy(
  () =>
    import(
      /* webpackChunkName: "CssTemplateList" */ 'src/pages/CssTemplateList'
    ),
);

const ThemeList = lazy(
  () => import(/* webpackChunkName: "ThemeList" */ 'src/pages/ThemeList'),
);

const DashboardList = lazy(
  () =>
    import(/* webpackChunkName: "DashboardList" */ 'src/pages/DashboardList'),
);

const Dashboard = lazy(
  () => import(/* webpackChunkName: "Dashboard" */ 'src/pages/Dashboard'),
);

const DatabaseList = lazy(
  () => import(/* webpackChunkName: "DatabaseList" */ 'src/pages/DatabaseList'),
);

const DatasetList = lazy(
  () => import(/* webpackChunkName: "DatasetList" */ 'src/pages/DatasetList'),
);

const DatasetCreation = lazy(
  () =>
    import(
      /* webpackChunkName: "DatasetCreation" */ 'src/pages/DatasetCreation'
    ),
);

const ExecutionLogList = lazy(
  () =>
    import(
      /* webpackChunkName: "ExecutionLogList" */ 'src/pages/ExecutionLogList'
    ),
);

const Chart = lazy(
  () => import(/* webpackChunkName: "Chart" */ 'src/pages/Chart'),
);

const QueryHistoryList = lazy(
  () =>
    import(
      /* webpackChunkName: "QueryHistoryList" */ 'src/pages/QueryHistoryList'
    ),
);

const SavedQueryList = lazy(
  () =>
    import(/* webpackChunkName: "SavedQueryList" */ 'src/pages/SavedQueryList'),
);

const SqlLab = lazy(
  () => import(/* webpackChunkName: "SqlLab" */ 'src/pages/SqlLab'),
);

const AllEntities = lazy(
  () => import(/* webpackChunkName: "AllEntities" */ 'src/pages/AllEntities'),
);

const Tags = lazy(
  () => import(/* webpackChunkName: "Tags" */ 'src/pages/Tags'),
);

const Extensions = lazy(
  () => import(/* webpackChunkName: "Tags" */ 'src/extensions/ExtensionsList'),
);

const RowLevelSecurityList = lazy(
  () =>
    import(
      /* webpackChunkName: "RowLevelSecurityList" */ 'src/pages/RowLevelSecurityList'
    ),
);

const TaskList = lazy(
  () => import(/* webpackChunkName: "TaskList" */ 'src/pages/TaskList'),
);

const RolesList = lazy(
  () => import(/* webpackChunkName: "RolesList" */ 'src/pages/RolesList'),
);

const UsersList: LazyExoticComponent<any> = lazy(
  () => import(/* webpackChunkName: "UsersList" */ 'src/pages/UsersList'),
);

const UserInfo = lazy(
  () => import(/* webpackChunkName: "UserInfo" */ 'src/pages/UserInfo'),
);
const ActionLogList: LazyExoticComponent<any> = lazy(
  () => import(/* webpackChunkName: "ActionLogList" */ 'src/pages/ActionLog'),
);

const Login = lazy(
  () => import(/* webpackChunkName: "Login" */ 'src/pages/Login'),
);

const Register = lazy(
  () => import(/* webpackChunkName: "Register" */ 'src/pages/Register'),
);

const GroupsList: LazyExoticComponent<any> = lazy(
  () => import(/* webpackChunkName: "GroupsList" */ 'src/pages/GroupsList'),
);
const UserRegistrations = lazy(
  () =>
    import(
      /* webpackChunkName: "UserRegistrations" */ 'src/pages/UserRegistrations'
    ),
);

const FileHandler = lazy(
  () => import(/* webpackChunkName: "FileHandler" */ 'src/pages/FileHandler'),
);

const RedirectWarning = lazy(
  () =>
    import(
      /* webpackChunkName: "RedirectWarning" */ 'src/pages/RedirectWarning'
    ),
);

type Routes = {
  path: string;
  Component: ComponentType<any>;
  Fallback?: ComponentType<any>;
  props?: ComponentProps<any>;
}[];

export const routes: Routes = [
  { path: RoutePaths.REDIRECT, Component: RedirectWarning },
  { path: RoutePaths.LOGIN, Component: Login },
  { path: RoutePaths.REGISTER_ACTIVATION, Component: Register },
  { path: RoutePaths.REGISTER, Component: Register },
  { path: RoutePaths.LOGOUT, Component: Login },
  { path: RoutePaths.HOME, Component: Home },
  { path: RoutePaths.FILE_HANDLER, Component: FileHandler },
  { path: RoutePaths.DASHBOARD_LIST, Component: DashboardList },
  { path: RoutePaths.DASHBOARD, Component: Dashboard },
  { path: RoutePaths.CHART_ADD, Component: ChartCreation },
  { path: RoutePaths.CHART_LIST, Component: ChartList },
  { path: RoutePaths.DATASET_LIST, Component: DatasetList },
  { path: RoutePaths.DATABASE_LIST, Component: DatabaseList },
  { path: RoutePaths.SAVED_QUERIES, Component: SavedQueryList },
  { path: RoutePaths.CSS_TEMPLATES, Component: CssTemplateList },
  { path: RoutePaths.THEMES, Component: ThemeList },
  { path: RoutePaths.ANNOTATION_LAYERS, Component: AnnotationLayerList },
  { path: RoutePaths.ANNOTATION_LIST, Component: AnnotationList },
  { path: RoutePaths.QUERY_HISTORY, Component: QueryHistoryList },
  { path: RoutePaths.ALERTS, Component: AlertReportList },
  {
    path: RoutePaths.REPORTS,
    Component: AlertReportList,
    props: { isReportEnabled: true },
  },
  { path: RoutePaths.ALERT_LOG, Component: ExecutionLogList },
  {
    path: RoutePaths.REPORT_LOG,
    Component: ExecutionLogList,
    props: { isReportEnabled: true },
  },
  { path: RoutePaths.EXPLORE, Component: Chart },
  { path: RoutePaths.EXPLORE_PERMALINK, Component: Chart },
  { path: RoutePaths.DATASET_ADD, Component: DatasetCreation },
  { path: RoutePaths.DATASET, Component: DatasetCreation },
  { path: RoutePaths.ROW_LEVEL_SECURITY, Component: RowLevelSecurityList },
  { path: RoutePaths.TASKS, Component: TaskList },
  { path: RoutePaths.SQLLAB, Component: SqlLab },
  { path: RoutePaths.USER_INFO, Component: UserInfo },
  { path: RoutePaths.ACTION_LOG, Component: ActionLogList },
  { path: RoutePaths.REGISTRATIONS, Component: UserRegistrations },
];

if (isFeatureEnabled(FeatureFlag.TaggingSystem)) {
  routes.push({ path: RoutePaths.ALL_ENTITIES, Component: AllEntities });
  routes.push({ path: RoutePaths.TAGS, Component: Tags });
}

const user = getBootstrapData()?.user;
const authRegistrationEnabled =
  getBootstrapData()?.common.conf.AUTH_USER_REGISTRATION;
const isAdmin = isUserAdmin(user);

if (isAdmin) {
  routes.push(
    { path: RoutePaths.ROLES, Component: RolesList },
    { path: RoutePaths.USERS, Component: UsersList },
    { path: RoutePaths.GROUPS, Component: GroupsList },
  );

  if (isFeatureEnabled(FeatureFlag.EnableExtensions)) {
    routes.push({ path: RoutePaths.EXTENSIONS, Component: Extensions });
  }
}

if (authRegistrationEnabled) {
  routes.push({ path: RoutePaths.REGISTRATIONS, Component: UserRegistrations });
}

const frontEndRoutes: Record<string, boolean> = routes
  .map(r => r.path)
  .reduce(
    (acc, curr) => ({
      ...acc,
      [curr]: true,
    }),
    {},
  );

export const isFrontendRoute = (path?: string): boolean => {
  if (path) {
    const basePath = path.split(/[?#]/)[0]; // strip out query params and link bookmarks
    return !!frontEndRoutes[basePath];
  }
  return false;
};

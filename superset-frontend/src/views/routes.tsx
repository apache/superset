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

// not lazy loaded since this is the home page.
import Home from 'src/pages/Home';

type RouteModule = { default: ComponentType<any> };
export type RouteLoader = () => Promise<RouteModule>;

// Import thunks are declared separately from the lazy() wrappers so the
// router can preload a route's chunk on intent (link hover/focus)
// without rendering it.
const loadChartCreation: RouteLoader = () =>
  import(/* webpackChunkName: "ChartCreation" */ 'src/pages/ChartCreation');
const loadAnnotationLayerList: RouteLoader = () =>
  import(
    /* webpackChunkName: "AnnotationLayerList" */ 'src/pages/AnnotationLayerList'
  );
const loadAlertReportList: RouteLoader = () =>
  import(/* webpackChunkName: "AlertReportList" */ 'src/pages/AlertReportList');
const loadAnnotationList: RouteLoader = () =>
  import(/* webpackChunkName: "AnnotationList" */ 'src/pages/AnnotationList');
const loadChartList: RouteLoader = () =>
  import(/* webpackChunkName: "ChartList" */ 'src/pages/ChartList');
const loadCssTemplateList: RouteLoader = () =>
  import(/* webpackChunkName: "CssTemplateList" */ 'src/pages/CssTemplateList');
const loadThemeList: RouteLoader = () =>
  import(/* webpackChunkName: "ThemeList" */ 'src/pages/ThemeList');
const loadDashboardList: RouteLoader = () =>
  import(/* webpackChunkName: "DashboardList" */ 'src/pages/DashboardList');
const loadDashboard: RouteLoader = () =>
  import(/* webpackChunkName: "Dashboard" */ 'src/pages/Dashboard');
const loadDatabaseList: RouteLoader = () =>
  import(/* webpackChunkName: "DatabaseList" */ 'src/pages/DatabaseList');
const loadDatasetList: RouteLoader = () =>
  import(/* webpackChunkName: "DatasetList" */ 'src/pages/DatasetList');
const loadDatasetCreation: RouteLoader = () =>
  import(/* webpackChunkName: "DatasetCreation" */ 'src/pages/DatasetCreation');
const loadExecutionLogList: RouteLoader = () =>
  import(
    /* webpackChunkName: "ExecutionLogList" */ 'src/pages/ExecutionLogList'
  );
const loadChart: RouteLoader = () =>
  import(/* webpackChunkName: "Chart" */ 'src/pages/Chart');
const loadQueryHistoryList: RouteLoader = () =>
  import(
    /* webpackChunkName: "QueryHistoryList" */ 'src/pages/QueryHistoryList'
  );
const loadSavedQueryList: RouteLoader = () =>
  import(/* webpackChunkName: "SavedQueryList" */ 'src/pages/SavedQueryList');
const loadSqlLab: RouteLoader = () =>
  import(/* webpackChunkName: "SqlLab" */ 'src/pages/SqlLab');
const loadAllEntities: RouteLoader = () =>
  import(/* webpackChunkName: "AllEntities" */ 'src/pages/AllEntities');
const loadTags: RouteLoader = () =>
  import(/* webpackChunkName: "Tags" */ 'src/pages/Tags');
const loadExtensions: RouteLoader = () =>
  import(/* webpackChunkName: "Tags" */ 'src/extensions/ExtensionsList');
const loadRowLevelSecurityList: RouteLoader = () =>
  import(
    /* webpackChunkName: "RowLevelSecurityList" */ 'src/pages/RowLevelSecurityList'
  );
const loadTaskList: RouteLoader = () =>
  import(/* webpackChunkName: "TaskList" */ 'src/pages/TaskList');
const loadRolesList: RouteLoader = () =>
  import(/* webpackChunkName: "RolesList" */ 'src/pages/RolesList');
const loadUsersList: RouteLoader = () =>
  import(/* webpackChunkName: "UsersList" */ 'src/pages/UsersList');
const loadUserInfo: RouteLoader = () =>
  import(/* webpackChunkName: "UserInfo" */ 'src/pages/UserInfo');
const loadActionLogList: RouteLoader = () =>
  import(/* webpackChunkName: "ActionLogList" */ 'src/pages/ActionLog');
const loadLogin: RouteLoader = () =>
  import(/* webpackChunkName: "Login" */ 'src/pages/Login');
const loadRegister: RouteLoader = () =>
  import(/* webpackChunkName: "Register" */ 'src/pages/Register');
const loadGroupsList: RouteLoader = () =>
  import(/* webpackChunkName: "GroupsList" */ 'src/pages/GroupsList');
const loadUserRegistrations: RouteLoader = () =>
  import(
    /* webpackChunkName: "UserRegistrations" */ 'src/pages/UserRegistrations'
  );
const loadFileHandler: RouteLoader = () =>
  import(/* webpackChunkName: "FileHandler" */ 'src/pages/FileHandler');
const loadRedirectWarning: RouteLoader = () =>
  import(/* webpackChunkName: "RedirectWarning" */ 'src/pages/RedirectWarning');

const ChartCreation = lazy(loadChartCreation);
const AnnotationLayerList = lazy(loadAnnotationLayerList);
const AlertReportList = lazy(loadAlertReportList);
const AnnotationList = lazy(loadAnnotationList);
const ChartList = lazy(loadChartList);
const CssTemplateList = lazy(loadCssTemplateList);
const ThemeList = lazy(loadThemeList);
const DashboardList = lazy(loadDashboardList);
const Dashboard = lazy(loadDashboard);
const DatabaseList = lazy(loadDatabaseList);
const DatasetList = lazy(loadDatasetList);
const DatasetCreation = lazy(loadDatasetCreation);
const ExecutionLogList = lazy(loadExecutionLogList);
const Chart = lazy(loadChart);
const QueryHistoryList = lazy(loadQueryHistoryList);
const SavedQueryList = lazy(loadSavedQueryList);
const SqlLab = lazy(loadSqlLab);
const AllEntities = lazy(loadAllEntities);
const Tags = lazy(loadTags);
const Extensions = lazy(loadExtensions);
const RowLevelSecurityList = lazy(loadRowLevelSecurityList);
const TaskList = lazy(loadTaskList);
const RolesList = lazy(loadRolesList);
const UsersList: LazyExoticComponent<any> = lazy(loadUsersList);
const UserInfo = lazy(loadUserInfo);
const ActionLogList: LazyExoticComponent<any> = lazy(loadActionLogList);
const Login = lazy(loadLogin);
const Register = lazy(loadRegister);
const GroupsList: LazyExoticComponent<any> = lazy(loadGroupsList);
const UserRegistrations = lazy(loadUserRegistrations);
const FileHandler = lazy(loadFileHandler);
const RedirectWarning = lazy(loadRedirectWarning);

type Routes = {
  path: string;
  Component: ComponentType;
  load?: RouteLoader;
  Fallback?: ComponentType;
  props?: ComponentProps<any>;
}[];

export const routes: Routes = [
  {
    path: '/redirect/',
    Component: RedirectWarning,
    load: loadRedirectWarning,
  },
  {
    path: '/login/',
    Component: Login,
    load: loadLogin,
  },
  {
    path: '/register/activation/:activationHash',
    Component: Register,
    load: loadRegister,
  },
  {
    path: '/register/',
    Component: Register,
    load: loadRegister,
  },
  {
    path: '/logout/',
    Component: Login,
    load: loadLogin,
  },
  {
    path: '/superset/welcome/',
    Component: Home,
  },
  {
    path: '/superset/file-handler',
    Component: FileHandler,
    load: loadFileHandler,
  },
  {
    path: '/dashboard/list/',
    Component: DashboardList,
    load: loadDashboardList,
  },
  {
    path: '/superset/dashboard/:idOrSlug/',
    Component: Dashboard,
    load: loadDashboard,
  },
  {
    path: '/chart/add',
    Component: ChartCreation,
    load: loadChartCreation,
  },
  {
    path: '/chart/list/',
    Component: ChartList,
    load: loadChartList,
  },
  {
    path: '/tablemodelview/list/',
    Component: DatasetList,
    load: loadDatasetList,
  },
  {
    path: '/databaseview/list/',
    Component: DatabaseList,
    load: loadDatabaseList,
  },
  {
    path: '/savedqueryview/list/',
    Component: SavedQueryList,
    load: loadSavedQueryList,
  },
  {
    path: '/csstemplatemodelview/list/',
    Component: CssTemplateList,
    load: loadCssTemplateList,
  },
  {
    path: '/theme/list/',
    Component: ThemeList,
    load: loadThemeList,
  },
  {
    path: '/annotationlayer/list/',
    Component: AnnotationLayerList,
    load: loadAnnotationLayerList,
  },
  {
    path: '/annotationlayer/:annotationLayerId/annotation/',
    Component: AnnotationList,
    load: loadAnnotationList,
  },
  {
    path: '/sqllab/history/',
    Component: QueryHistoryList,
    load: loadQueryHistoryList,
  },
  {
    path: '/alert/list/',
    Component: AlertReportList,
    load: loadAlertReportList,
  },
  {
    path: '/report/list/',
    Component: AlertReportList,
    load: loadAlertReportList,
    props: {
      isReportEnabled: true,
    },
  },
  {
    path: '/alert/:alertId/log/',
    Component: ExecutionLogList,
    load: loadExecutionLogList,
  },
  {
    path: '/report/:alertId/log/',
    Component: ExecutionLogList,
    load: loadExecutionLogList,
    props: {
      isReportEnabled: true,
    },
  },
  {
    path: '/explore/',
    Component: Chart,
    load: loadChart,
  },
  {
    path: '/superset/explore/p',
    Component: Chart,
    load: loadChart,
  },
  {
    path: '/dataset/add/',
    Component: DatasetCreation,
    load: loadDatasetCreation,
  },
  {
    path: '/dataset/:datasetId',
    Component: DatasetCreation,
    load: loadDatasetCreation,
  },
  {
    path: '/rowlevelsecurity/list',
    Component: RowLevelSecurityList,
    load: loadRowLevelSecurityList,
  },
  {
    path: '/tasks/list/',
    Component: TaskList,
    load: loadTaskList,
  },
  {
    path: '/sqllab/',
    Component: SqlLab,
    load: loadSqlLab,
  },
  { path: '/user_info/', Component: UserInfo, load: loadUserInfo },
  {
    path: '/actionlog/list',
    Component: ActionLogList,
    load: loadActionLogList,
  },
  {
    path: '/registrations/',
    Component: UserRegistrations,
    load: loadUserRegistrations,
  },
];

if (isFeatureEnabled(FeatureFlag.TaggingSystem)) {
  routes.push({
    path: '/superset/all_entities/',
    Component: AllEntities,
    load: loadAllEntities,
  });
  routes.push({
    path: '/superset/tags/',
    Component: Tags,
    load: loadTags,
  });
}

const user = getBootstrapData()?.user;
const authRegistrationEnabled =
  getBootstrapData()?.common.conf.AUTH_USER_REGISTRATION;
const isAdmin = isUserAdmin(user);

if (isAdmin) {
  routes.push(
    {
      path: '/roles/',
      Component: RolesList,
      load: loadRolesList,
    },
    {
      path: '/users/',
      Component: UsersList,
      load: loadUsersList,
    },
    {
      path: '/list_groups/',
      Component: GroupsList,
      load: loadGroupsList,
    },
  );

  if (isFeatureEnabled(FeatureFlag.EnableExtensions)) {
    routes.push({
      path: '/extensions/list/',
      Component: Extensions,
      load: loadExtensions,
    });
  }
}

if (authRegistrationEnabled) {
  routes.push({
    path: '/registrations/',
    Component: UserRegistrations,
    load: loadUserRegistrations,
  });
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

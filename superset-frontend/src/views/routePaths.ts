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

export const RoutePaths = {
  REDIRECT: '/redirect/',
  LOGIN: '/login/',
  REGISTER_ACTIVATION: '/register/activation/:activationHash',
  REGISTER: '/register/',
  LOGOUT: '/logout/',
  HOME: '/superset/welcome/',
  FILE_HANDLER: '/superset/file-handler',
  DASHBOARD: '/superset/dashboard/:idOrSlug/',
  DASHBOARD_LIST: '/dashboard/list/',
  CHART_ADD: '/chart/add',
  CHART_LIST: '/chart/list/',
  DATASET_LIST: '/tablemodelview/list/',
  DATABASE_LIST: '/databaseview/list/',
  SAVED_QUERIES: '/savedqueryview/list/',
  CSS_TEMPLATES: '/csstemplatemodelview/list/',
  THEMES: '/theme/list/',
  ANNOTATION_LAYERS: '/annotationlayer/list/',
  ANNOTATION_LIST: '/annotationlayer/:annotationLayerId/annotation/',
  QUERY_HISTORY: '/sqllab/history/',
  ALERTS: '/alert/list/',
  REPORTS: '/report/list/',
  ALERT_LOG: '/alert/:alertId/log/',
  REPORT_LOG: '/report/:alertId/log/',
  EXPLORE: '/explore/',
  EXPLORE_PERMALINK: '/superset/explore/p',
  DATASET_ADD: '/dataset/add/',
  DATASET: '/dataset/:datasetId',
  ROW_LEVEL_SECURITY: '/rowlevelsecurity/list',
  TASKS: '/tasks/list/',
  SQLLAB: '/sqllab/',
  USER_INFO: '/user_info/',
  ACTION_LOG: '/actionlog/list',
  REGISTRATIONS: '/registrations/',
  ALL_ENTITIES: '/superset/all_entities/',
  TAGS: '/superset/tags/',
  ROLES: '/roles/',
  USERS: '/users/',
  GROUPS: '/list_groups/',
  EXTENSIONS: '/extensions/list/',
} as const;

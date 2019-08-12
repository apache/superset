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
import { t } from '@superset-ui/translation';
import getToastsFromPyFlashMessages from '../../messageToasts/utils/getToastsFromPyFlashMessages';

export default function getInitialState({ defaultDbId, ...restBootstrapData }) {
  const queryEditors = [];

  const defaultQueryEditor = {
    id: null,
    loaded: true,
    title: t('Untitled Query'),
    sql: 'SELECT *\nFROM\nWHERE',
    selectedText: null,
    latestQueryId: null,
    autorun: false,
    templateParams: null,
    dbId: defaultDbId,
    queryLimit: restBootstrapData.common.conf.DEFAULT_SQLLAB_LIMIT,
    validationResult: {
      id: null,
      errors: [],
      completed: false,
    },
  };

  restBootstrapData.tab_state_ids.forEach(({ id, label }) => {
    let queryEditor;
    if (restBootstrapData.active_tab && restBootstrapData.active_tab.id === id) {
      // id is cast to string for backwards compatibility
      queryEditor = {
        id: id.toString(),
        loaded: true,
        title: restBootstrapData.active_tab.label,
        sql: restBootstrapData.active_tab.query.sql,
        selectedText: null,
        latestQueryId: restBootstrapData.active_tab.query.id,
        autorun: restBootstrapData.active_tab.autorun,
        templateParams: restBootstrapData.active_tab.template_params,
        dbId: restBootstrapData.active_tab.database_id,
        schema: restBootstrapData.active_tab.schema,
        queryLimit: restBootstrapData.active_tab.queryLimit,
        validationResult: {
          id: null,
          errors: [],
          completed: false,
        },
      };
    } else {
      // dummy state, actual state will be loaded on tab switch
      queryEditor = {
        ...defaultQueryEditor,
        id: id.toString(),
        loaded: false,
        title: label,
      };
    }
    queryEditors.push(queryEditor);
  });

  const tabHistory = restBootstrapData.active_tab
    ? [restBootstrapData.active_tab.id.toString()]
    : [];

  const tables = [];
  if (restBootstrapData.active_tab) {
    restBootstrapData.active_tab.table_schemas.forEach((tableSchema) => {
      const {
        columns,
        selectStar,
        primaryKey,
        foreignKeys,
        indexes,
      } = tableSchema.results;
      const table = {
        dbId: tableSchema.database_id,
        queryEditorId: tableSchema.tab_state_id.toString(),
        schema: tableSchema.schema,
        name: tableSchema.table,
        expanded: tableSchema.expanded,
        id: tableSchema.id,
        dataPreviewQueryId: null,
        columns,
        selectStar,
        primaryKey,
        foreignKeys,
        indexes,
      };
      tables.push(table);
    });
  }

  return {
    sqlLab: {
      activeSouthPaneTab: 'Results',
      alerts: [],
      databases: restBootstrapData.databases,
      offline: false,
      queries: restBootstrapData.queries,
      queryEditors,
      tabHistory,
      tables,
      queriesLastUpdate: Date.now(),
    },
    messageToasts: getToastsFromPyFlashMessages(
      (restBootstrapData.common || {}).flash_messages || [],
    ),
    localStorageUsageInKilobytes: 0,
    common: {
      flash_messages: restBootstrapData.common.flash_messages,
      conf: restBootstrapData.common.conf,
    },
  };
}

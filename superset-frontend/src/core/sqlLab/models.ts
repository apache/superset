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
import { sqlLab as sqlLabType, core as coreType } from '@apache-superset/core';

const { CTASMethod } = sqlLabType;

export class Panel implements sqlLabType.Panel {
  id: string;

  constructor(id: string) {
    this.id = id;
  }
}

export class Editor implements sqlLabType.Editor {
  content: string;

  databaseId: number;

  schema: string;

  // TODO: Check later if we'll use objects instead of strings.
  catalog: string | null;

  table: string | null;

  constructor(
    content: string,
    databaseId: number,
    catalog: string | null = null,
    schema = '',
    table: string | null = null,
  ) {
    this.content = content;
    this.databaseId = databaseId;
    this.catalog = catalog;
    this.schema = schema;
    this.table = table;
  }
}

export class Tab implements sqlLabType.Tab {
  id: string;

  title: string;

  editor: Editor;

  panels: Panel[];

  constructor(id: string, title: string, editor: Editor, panels: Panel[] = []) {
    this.id = id;
    this.title = title;
    this.editor = editor;
    this.panels = panels;
  }
}

export class CTAS implements sqlLabType.CTAS {
  method: sqlLabType.CTASMethod;

  tempTable: string;

  constructor(asView: boolean, tempTable: string) {
    this.method = asView ? CTASMethod.View : CTASMethod.Table;
    this.tempTable = tempTable;
  }
}

export class QueryContext implements sqlLabType.QueryContext {
  clientId: string;

  ctas: sqlLabType.CTAS | null;

  editor: Editor;

  requestedLimit: number | null;

  runAsync: boolean;

  startDttm: number;

  tab: Tab;

  private templateParams: string;

  private parsedParams: Record<string, any>;

  constructor(
    clientId: string,
    tab: Tab,
    runAsync: boolean,
    startDttm: number,
    options: {
      templateParams?: string;
      ctasMethod?: string;
      tempTable?: string;
      requestedLimit?: number;
    } = {},
  ) {
    this.clientId = clientId;
    this.tab = tab;
    this.editor = tab.editor;
    this.runAsync = runAsync;
    this.startDttm = startDttm;
    this.requestedLimit = options.requestedLimit ?? null;
    this.ctas = options.tempTable
      ? new CTAS(options.ctasMethod === CTASMethod.View, options.tempTable)
      : null;
    this.templateParams = options.templateParams ?? '';
  }

  /**
   * A custom accessor is used to process JSON parsing only
   * when necessary for better performance.
   */
  get templateParameters() {
    if (this.parsedParams) {
      return this.parsedParams;
    }

    let parsed = {};
    try {
      parsed = JSON.parse(this.templateParams);
    } catch (e) {
      // ignore invalid format string.
    }
    this.parsedParams = parsed;

    return parsed;
  }
}

export class QueryResultContext
  extends QueryContext
  implements sqlLabType.QueryResultContext
{
  appliedLimit: number;

  appliedLimitingFactor: string;

  endDttm: number;

  executedSql: string;

  remoteId: number;

  result: sqlLabType.QueryResult;

  constructor(
    clientId: string,
    tab: Tab,
    runAsync: boolean,
    startDttm: number,
    remoteId: number,
    executedSql: string,
    columns: sqlLabType.QueryResult['columns'],
    data: sqlLabType.QueryResult['data'],
    endDttm: number,
    options: {
      appliedLimit?: number;
      appliedLimitingFactor?: string;
      templateParams?: string;
      ctasMethod?: string;
      tempTable?: string;
      requestedLimit?: number;
    } = {},
  ) {
    const { appliedLimit, appliedLimitingFactor, ...opt } = options;
    super(clientId, tab, runAsync, startDttm, opt);
    this.remoteId = remoteId;
    this.executedSql = executedSql;
    this.endDttm = endDttm;
    this.result = {
      columns,
      data,
    };
    this.appliedLimit = appliedLimit ?? data.length;
    this.appliedLimitingFactor = options.appliedLimitingFactor ?? '';
  }
}

export class QueryErrorResultContext
  extends QueryContext
  implements sqlLabType.QueryErrorResultContext
{
  endDttm: number;

  errorMessage: string;

  errors: coreType.SupersetError[] | null;

  executedSql: string | null;

  constructor(
    clientId: string,
    tab: Tab,
    runAsync: boolean,
    startDttm: number,
    errorMessage: string,
    errors: coreType.SupersetError[],
    options: {
      ctasMethod?: string;
      executedSql?: string;
      endDttm?: number;
      templateParams?: string;
      tempTable?: string;
      requestedLimist?: number;
      queryId?: number;
    } = {},
  ) {
    const { queryId, executedSql, endDttm, ...opt } = options;
    super(clientId, tab, runAsync, startDttm, opt);
    this.executedSql = executedSql ?? null;
    this.errorMessage = errorMessage;
    this.errors = errors;
    this.endDttm = endDttm ?? Date.now();
  }
}

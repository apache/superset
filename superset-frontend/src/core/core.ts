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
import { core as coreType, sqlLab as sqlLabType } from '@apache-superset/core';
import { getExtensionsContextValue } from '../extensions/ExtensionsContextUtils';

const { CTASMethod } = sqlLabType;

export class Column implements coreType.Column {
  name: string;

  type: string;

  constructor(name: string, type: string) {
    this.name = name;
    this.type = type;
  }
}

export class Table implements coreType.Table {
  name: string;

  columns: Column[];

  constructor(name: string, columns: Column[]) {
    this.name = name;
    this.columns = columns;
  }

  addColumn(column: Column): void {
    this.columns.push(column);
  }
}

export class Catalog implements coreType.Catalog {
  name: string;

  description?: string;

  constructor(name: string, description?: string) {
    this.name = name;
    this.description = description;
  }
}

export class Schema implements coreType.Schema {
  tables: Table[];

  constructor(tables: Table[]) {
    this.tables = tables;
  }

  addTable(table: Table): void {
    this.tables.push(table);
  }
}

export class Database implements coreType.Database {
  id: number;

  name: string;

  catalogs: Catalog[];

  schemas: Schema[];

  constructor(
    id: number,
    name: string,
    catalogs: Catalog[],
    schemas: Schema[],
  ) {
    this.id = id;
    this.name = name;
    this.catalogs = catalogs;
    this.schemas = schemas;
  }

  addCatalog(catalog: Catalog): void {
    this.catalogs.push(catalog);
  }

  addSchema(schema: Schema): void {
    this.schemas.push(schema);
  }
}

export class Disposable implements coreType.Disposable {
  static from(
    ...disposableLikes: {
      dispose: () => any;
    }[]
  ): Disposable {
    return new Disposable(() => {
      disposableLikes.forEach(disposable => {
        disposable.dispose();
      });
    });
  }

  constructor(callOnDispose: () => any) {
    this.dispose = callOnDispose;
  }

  dispose(): any {
    this.dispose();
  }
}

export class ExtensionContext implements coreType.ExtensionContext {
  disposables: coreType.Disposable[] = [];
}

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
export class QueryRequestContext implements sqlLabType.QueryRequestContext {
  id: string;

  ctas: sqlLabType.CTAS | null;

  editor: Editor;

  queryLimit: number | null;

  runAsync: boolean;

  startDttm: number;

  tab: Tab;

  templateParams: string;

  constructor(
    id: string,
    editor: Editor,
    tab: Tab,
    runAsync: boolean,
    startDttm: number,
    options: {
      templateParams?: string;
      ctasMethod?: string;
      tempTable?: string;
    } = {},
  ) {
    this.id = id;
    this.editor = editor;
    this.tab = tab;
    this.runAsync = runAsync;
    this.startDttm = startDttm;
    this.ctas = options.tempTable
      ? new CTAS(options.ctasMethod === CTASMethod.View, options.tempTable)
      : null;
    this.templateParams = options.templateParams ?? '';
  }
}

export class QueryResultContext
  extends QueryRequestContext
  implements sqlLabType.QueryResultContext
{
  endDttm: number;

  executedSql: string;

  limit: number;

  limitingFactor: string;

  queryId: number;

  result: sqlLabType.QueryResult;

  constructor(
    id: string,
    queryId: number,
    executedSql: string,
    columns: sqlLabType.QueryResult['columns'],
    data: sqlLabType.QueryResult['data'],
    editor: Editor,
    tab: Tab,
    runAsync: boolean,
    startDttm: number,
    endDttm: number,
    options: {
      templateParams?: string;
      ctasMethod?: string;
      tempTable?: string;
      limit?: number;
      limitingFactor?: string;
    } = {},
  ) {
    const { limit, ...opt } = options;
    super(id, editor, tab, runAsync, startDttm, opt);
    this.queryId = queryId;
    this.executedSql = executedSql;
    this.endDttm = endDttm;
    this.result = {
      columns,
      data,
    };
    this.limit = limit ?? data.length;
    this.limitingFactor = options.limitingFactor ?? '';
  }
}

export class QueryErrorResultContext
  extends QueryRequestContext
  implements sqlLabType.QueryErrorResultContext
{
  endDttm: number;

  errorMessage: string;

  errors: sqlLabType.SupersetError[];

  executedSql: string | null;

  constructor(
    id: string,
    errorMessage: string,
    errors: sqlLabType.SupersetError[],
    editor: Editor,
    tab: Tab,
    runAsync: boolean,
    startDttm: number,
    options: {
      queryId?: number;
      executedSql?: string;
      endDttm?: number;
      templateParams?: string;
      ctasMethod?: string;
      tempTable?: string;
    } = {},
  ) {
    const { queryId, executedSql, endDttm, ...opt } = options;
    super(id, editor, tab, runAsync, startDttm, opt);
    this.executedSql = executedSql ?? null;
    this.errorMessage = errorMessage;
    this.errors = errors;
    this.endDttm = endDttm ?? Date.now();
  }
}

const registerViewProvider: typeof coreType.registerViewProvider = (
  id,
  viewProvider,
) => {
  const { registerViewProvider: register, unregisterViewProvider: unregister } =
    getExtensionsContextValue();
  register(id, viewProvider);
  return new Disposable(() => unregister(id));
};

export const core: typeof coreType = {
  registerViewProvider,
  Disposable,
};

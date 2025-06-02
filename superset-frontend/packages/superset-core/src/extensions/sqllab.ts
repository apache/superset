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
import { core, sqlLab } from '../api';

export class Tab implements sqlLab.Tab {
  id: string;
  title: string;
  editor: sqlLab.Editor;
  panels: sqlLab.Panel[];

  constructor(
    id: string,
    title: string,
    editor: sqlLab.Editor,
    panels: sqlLab.Panel[] = [],
  ) {
    this.id = id;
    this.title = title;
    this.editor = editor;
    this.panels = panels;
  }
}

export class Editor implements sqlLab.Editor {
  content: string;
  database: core.Database;
  // TODO: Check later if we'll use objects instead of strings.
  catalog: string | null;
  schema: string;
  table: string;

  constructor(
    content: string,
    database: core.Database,
    catalog: string | null = null,
    schema: string = '',
    table: string = '',
  ) {
    this.content = content;
    this.database = database;
    this.catalog = catalog;
    this.schema = schema;
    this.table = table;
  }
}

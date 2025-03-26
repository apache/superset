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
import { Event, Database, Table, Schema } from './core';

export declare namespace sqlLab {
  export interface Editor {}

  export interface Panel {
    /**
     * Show the panel in the UI.
     *
     * @param preserveFocus When `true` the panel will not take focus.
     */
    show(preserveFocus?: boolean): void;

    /**
     * Hide the panel if it's currently showing.
     */
    hide(): void;

    /**
     * Dispose and free associated resources.
     */
    dispose(): void;
  }

  export const databases: Database[];

  // Examples of database events

  export const onDidChangeActiveDatabase: Event<Database>;

  export const onDidChangeDatabase: Event<Database>;

  // Examples of schema events

  export const onDidRefreshSchema: Event<Schema>;

  // Examples of table events

  export const onDidRefreshTable: Event<Table>;

  export const editors: Editor[];

  export const panels: Panel[];

  // Examples of panel events

  export const onDidChangeActivePanel: Event<Panel | undefined>;

  export const onDidOpenPanel: Event<Panel>;

  export const onDidClosePanel: Event<Panel>;

  export const onDidChangePanelState: Event<Panel>;
}

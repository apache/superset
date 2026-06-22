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
/**
 * View locations for SQL Lab extension integration.
 *
 * These define the locations where extensions can contribute views and menus.
 * The nested structure mirrors the extension.json contribution schema.
 *
 * @example
 * // In extension.json:
 * {
 *   "contributions": {
 *     "views": {
 *       "sqllab": {
 *         "panels": [{ "id": "my-ext.panel", "name": "My Panel" }]
 *       }
 *     }
 *   }
 * }
 *
 * // In component code:
 * <ViewListExtension viewId={ViewLocations.sqllab.panels} />
 */
export const ViewLocations = {
  sqllab: {
    leftSidebar: 'sqllab.leftSidebar',
    rightSidebar: 'sqllab.rightSidebar',
    panels: 'sqllab.panels',
    editor: 'sqllab.editor',
    statusBar: 'sqllab.statusBar',
    results: 'sqllab.results',
    queryHistory: 'sqllab.queryHistory',
  },
} as const;

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
import { core, sqlLab, commands, authentication } from '@apache-superset/core';
import { message } from 'antd';

export const activate = (_context: core.ExtensionContext) => {
  commands.registerCommand('sqllab_parquet.export', async () => {
    const currentTab = sqlLab.getCurrentTab();

    if (!currentTab) {
      message.warning('No active tab found.');
      return;
    }

    const { editor } = currentTab;
    const sql = editor.content?.trim();

    if (!sql) {
      message.warning('No SQL query to export. Please write a query first.');
      return;
    }

    if (!editor.databaseId) {
      message.warning('No database selected. Please select a database first.');
      return;
    }

    const hideLoading = message.loading('Exporting to Parquet...', 0);

    try {
      const csrfToken = await authentication.getCSRFToken();

      const response = await fetch('/extensions/sqllab_parquet/export/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken!,
        },
        body: JSON.stringify({
          sql: editor.content,
          databaseId: editor.databaseId,
          catalog: editor.catalog,
          schema: editor.schema,
        }),
      });

      hideLoading();

      if (response.ok) {
        const blob = await response.blob();
        const filename =
          response.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] ||
          'query_results.parquet';

        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        message.success('Exported to Parquet successfully');
      } else {
        let errorMessage = 'Export failed';
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch {
          errorMessage = `Export failed: ${response.statusText || `HTTP ${response.status}`}`;
        }
        message.error(errorMessage);
      }
    } catch (error) {
      hideLoading();
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      message.error(`Export failed: ${errorMessage}`);
    }
  });
};

export const deactivate = () => {};

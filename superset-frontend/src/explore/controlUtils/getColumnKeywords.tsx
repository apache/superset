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

import { ColumnMeta } from '@superset-ui/chart-controls';
import { t } from '@superset-ui/core';
import { getTooltipHTML } from 'src/components/AsyncAceEditor';
import { COLUMN_AUTOCOMPLETE_SCORE } from 'src/SqlLab/constants';

export function getColumnKeywords(columns: ColumnMeta[]) {
  return columns.map(
    ({
      column_name,
      verbose_name,
      is_certified,
      certified_by,
      description,
      type,
    }) => ({
      name: verbose_name || column_name,
      value: column_name,
      docHTML: getTooltipHTML({
        title: column_name,
        meta: type ? `column: ${type}` : 'column',
        body: `${description ?? ''}`,
        footer: is_certified ? (
          <>{t('Certified by %s', certified_by)}</>
        ) : undefined,
      }),
      score: COLUMN_AUTOCOMPLETE_SCORE,
      meta: 'column',
    }),
  );
}

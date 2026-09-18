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
 * @fileoverview Opening suggestions derived on the client.
 *
 * These name the thing on screen — this chart, this dashboard tab, this query —
 * using page context that is already in hand, so they cost nothing.
 *
 * A deployment can additionally have the backend generate them
 * (`AI_SUGGESTED_PROMPTS_ENABLED`), which produces sharper suggestions because
 * the model can read the columns and filters rather than just the page type.
 * That costs a round trip, so these remain the default and the fallback: they
 * fill the row while a request is in flight, and they stand when the backend is
 * not configured to generate any, has nothing to add, or fails.
 */

import { t } from '@apache-superset/core/translation';
import type { PageContext } from './usePageContext';

/** The row has space for three chips before it wraps past one line. */
const MAX_PROMPTS = 3;

const quote = (value: string | undefined): string | undefined =>
  value?.trim() ? `"${value.trim()}"` : undefined;

/**
 * Suggestions for the current page, most specific first.
 *
 * A page whose context has not loaded yet falls through to the generic set, so
 * the row is never empty while the user waits.
 */
export function buildQuickPrompts(context: PageContext): string[] {
  const prompts: string[] = [];

  switch (context.pageType) {
    case 'sqllab': {
      const editor = context.sqlContext?.activeEditor;
      if (editor?.sql?.trim()) {
        prompts.push(
          t('Explain what the query in this tab does'),
          t('Find the mistake in this query'),
          t('Rewrite this query to run faster'),
        );
      } else {
        prompts.push(
          t('What tables can I query on this database?'),
          t('Write a query that counts rows per day'),
        );
      }
      if (editor?.schema) {
        prompts.push(t('Describe the tables in the %s schema', editor.schema));
      }
      break;
    }
    case 'explore':
    case 'chart': {
      const name = quote(
        context.chartContext?.chartName ??
          context.chartContext?.slice?.slice_name,
      );
      prompts.push(
        name
          ? t('Explain what %s is showing', name)
          : t('Explain what this chart is showing'),
        t('Which columns of this dataset am I not using?'),
        t('Suggest a better chart type for this data'),
      );
      break;
    }
    case 'dashboard': {
      const title = quote(context.dashboardContext?.title);
      prompts.push(
        title
          ? t('Summarise what %s tells me', title)
          : t('Summarise what this dashboard tells me'),
      );
      if (context.dashboardContext?.activeFilters?.length) {
        prompts.push(t('Which filters are applied right now?'));
      }
      prompts.push(t('Which chart here is the odd one out?'));
      break;
    }
    default:
      prompts.push(
        t('What dashboards have I looked at recently?'),
        t('Find a dataset about orders'),
        t('Write a query I can start from'),
      );
      break;
  }

  return prompts.slice(0, MAX_PROMPTS);
}

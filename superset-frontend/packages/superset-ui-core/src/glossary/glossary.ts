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
 * Glossary definition containing terms organized by topic.
 * 
 * ## How to add new glossary entries:
 * 
 * 1. Add a new topic (if needed) or use an existing one
 * 2. Add a term under the topic with a key (term name) and value object containing:
 *    - short: A brief description (displayed in tooltips)
 *    - extended (optional): An extended description (displayed in documentation)
 * 
 * ## Example:
 * export const glossaryDefinition: GlossaryDefinition = {
 *   Query: {
 *     Row_Limit: {
 *       short: t('Limits the number of rows...'),
 *       extended: t('Additional details...'), // optional
 *     },
 *   },
 * };
 * 
 * ## Formatting Notes:
 * - Term names with underscores (e.g., `Row_Limit`) will be displayed with spaces 
 *   (e.g., "Row Limit") when rendered in the UI and documentation
 */

export const glossaryDefinition: GlossaryDefinition = {
  Query: {
    Dimension: {
      short: t(
        'Dimensions contain qualitative values such as names, dates, or geographical data. Use dimensions to categorize, segment, and reveal the details in your data. Dimensions affect the level of detail in the view.',
      ),
    },
    Metric: {
      short: t(
        'Select one or many metrics to display. You can use an aggregation function on a column or write custom SQL to create a metric.',
      ),
    },
    Series: {
      short: t(
        'Limits the number of series that get displayed. A joined subquery (or an extra phase where subqueries are not supported) is applied to limit the number of series that get fetched and rendered. This feature is useful when grouping by high cardinality column(s) though does increase the query complexity and cost.',
      ),
    },
    Row_Limit: {
      short: t(
        'Limits the number of rows that get displayed. This feature is useful when grouping by high cardinality column(s) though does increase the query complexity and cost.',
      ),
    },
    Sort: {
      short: t(
        'Orders the query result that generates the source data for this chart. If a series or row limit is reached, this determines what data are truncated. If undefined, defaults to the first metric (where appropriate).',
      ),
    }
  },
};

/**
 * Use this identity translate function as some environments (docs) do not have i18n setup.
 */
function t(message: string): string {
  return message;
}

/**
 * The glossary definition is a nested object where the first level keys are topics,
 * and the second level keys are term titles. This remains a static string-based
 * structure, mainly for good IDE autocomplete.
 */
export type GlossaryStrings = {
  short: string;
  extended?: string;
};
export type GlossaryDefinition = Record<string, Record<string, GlossaryStrings>>;

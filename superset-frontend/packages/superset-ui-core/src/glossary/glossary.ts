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

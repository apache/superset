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

export interface GlossaryTerm {
  /**
   * The name of the term being defined.
   */
  title: string;
  /**
   * A short description of the term. Displayed on the frontend as a tooltip.
   */
  short: string;
  /**
   * An extended description of the term, shown alongside short on the documentation.
   */
  extended?: string;
}

export const GlossaryStructure = [
  {
    title: 'Term',
    dataIndex: 'title',
    key: 'title',
  },
  {
    title: 'Short Description',
    dataIndex: 'short',
    key: 'short',
  }
]

export const Glossary: GlossaryTerm[] = [
  {
    title: 'First Tooltip',
    short: 'This is an example tooltip describing the meaning and usage of feature 1. This is an example tooltip describing the meaning and usage of feature 1.',
    extended: 'This is an example tooltip describing the meaning and usage of feature 1. This is an example tooltip describing the meaning and usage of feature 1.'
  },
  {
    title: 'Second Tooltip',
    short: 'This is an example tooltip describing the meaning and usage of feature 2.',
    extended: 'This is an example tooltip describing the meaning and usage of feature 2. This is an example tooltip describing the meaning and usage of feature 2.'
  },
];



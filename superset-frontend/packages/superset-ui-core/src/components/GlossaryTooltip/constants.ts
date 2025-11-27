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

export const GLOSSARY_BASE_URL = 'http://localhost:3000'; // TODO: change to the actual URL

export const GLOSSARY_TERMS = {
  Dimension: 'First Tooltip',
} as const;

export type GlossaryTerm = typeof GLOSSARY_TERMS[keyof typeof GLOSSARY_TERMS];

export const getGlossaryUrl = (term: GlossaryTerm): string => {
  return `${GLOSSARY_BASE_URL}/docs/glossary#${term}`;
};


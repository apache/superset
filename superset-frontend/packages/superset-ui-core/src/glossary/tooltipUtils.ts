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

import { getGlossaryTopic } from './glossaryUtils';
import { t } from '@superset-ui/core';

export const GLOSSARY_BASE_URL = 'https://superset.apache.org/docs';

// Pattern matches: [GLOSSARY]|topic|title
// Captures: topic and title for lookup in glossary
const GLOSSARY_ENCODING_PATTERN = /^\[GLOSSARY\]\|([^|]+)\|([^|]+)$/;

export const resolveGlossaryString = (
  glossaryString: string,
): [string | undefined, string] => {
  const encoded = glossaryString.trim();
  const match = encoded.match(GLOSSARY_ENCODING_PATTERN);
  if (!match) {
    return [undefined, encoded];
  }
  const topic = match[1];
  const title = match[2];

  // Look up the term from the glossary to get the translated description
  const glossaryTopic = getGlossaryTopic(topic);
  const term = glossaryTopic?.getTerm(title);
  const description = term ? term.getShort(t) : encoded;

  const glossaryUrl = buildGlossaryUrl(topic, title);
  return [glossaryUrl, description];
};

const buildGlossaryUrl = (topic: string, title: string): string =>
  `${GLOSSARY_BASE_URL}/glossary#${encodeURIComponent(`${topic}__${title}`)}`;

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

import { GlossaryMap, GlossaryTerm, type GlossaryTopic } from './glossaryModels';
import { glossaryDefinition } from './glossary';

export const GLOSSARY_BASE_URL = 'http://localhost:3000/docs'; // TODO: Change to use the url for the environment.

/**
 * The exported glossary object is a runtime structure where each entry is a GlossaryTerm instance, but the key
 * structure mirrors `glossaryDefinition` so IDEs can autocomplete, yet callers can use methods like `getShort()`.
 */
export type Glossary = {
  [Topic in keyof typeof glossaryDefinition]: {
    [Title in keyof (typeof glossaryDefinition)[Topic]]: GlossaryTerm;
  };
};

const glossary: Glossary = Object.fromEntries(
  Object.entries(glossaryDefinition).map(([topic, termsByTitle]) => [
    topic,
    Object.fromEntries(
      Object.entries(termsByTitle).map(([title, termStrings]) => [
        title,
        new GlossaryTerm({
          topic,
          title,
          short: termStrings.short,
          extended: termStrings.extended,
        }),
      ]),
    ),
  ]),
) as Glossary;

const glossaryMap = new GlossaryMap(glossary);

export const getAllGlossaryTopics = (): GlossaryTopic[] => glossaryMap.getAllTopics();

export const getGlossaryTopic = (topicName: string): GlossaryTopic | undefined =>
  glossaryMap.getTopic(topicName);

export const getGlossaryUrl = (term: GlossaryTerm): string =>
  `${GLOSSARY_BASE_URL}/glossary#${encodeURIComponent(
    term.getTopic() + '__' + term.getTitle(),
  )}`;

export default glossary;
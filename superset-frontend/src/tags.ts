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
import { JsonObject, SupersetClient } from '@superset-ui/core';
import Tag from 'src/types/Tag';

export const OBJECT_TYPES = Object.freeze({
  DASHBOARD: 'dashboard',
  CHART: 'chart',
  QUERY: 'query',
});

export function fetchTags(
  {
    objectType,
    objectId,
    includeTypes = false,
  }: { objectType: string; objectId: number; includeTypes: boolean },
  callback: (json: JsonObject) => void,
  error: (response: Response) => void,
) {
  if (objectType === undefined || objectId === undefined) {
    throw new Error('Need to specify objectType and objectId');
  }
  SupersetClient.get({ endpoint: `/tagview/tags/${objectType}/${objectId}/` })
    .then(({ json }) =>
      callback(
        json.filter((tag: Tag) => tag.name.indexOf(':') === -1 || includeTypes),
      ),
    )
    .catch(response => error(response));
}

export function fetchSuggestions(
  { includeTypes = false },
  callback: (json: JsonObject) => void,
  error: (response: Response) => void,
) {
  SupersetClient.get({ endpoint: '/tagview/tags/suggestions/' })
    .then(({ json }) =>
      callback(
        json.filter((tag: Tag) => tag.name.indexOf(':') === -1 || includeTypes),
      ),
    )
    .catch(response => error(response));
}

export function deleteTag(
  { objectType, objectId }: { objectType: string; objectId: number },
  tag: Tag,
  callback: (text: string) => void,
  error: (response: Response) => void,
) {
  if (objectType === undefined || objectId === undefined) {
    throw new Error('Need to specify objectType and objectId');
  }
  SupersetClient.delete({
    endpoint: `/tagview/tags/${objectType}/${objectId}/`,
    body: JSON.stringify([tag]),
    parseMethod: 'text',
  })
    .then(({ text }) => callback(text))
    .catch(response => error(response));
}

export function addTag(
  {
    objectType,
    objectId,
    includeTypes = false,
  }: { objectType: string; objectId: number; includeTypes: boolean },
  tag: string,
  callback: (text: string) => void,
  error: (response: Response) => void,
) {
  if (objectType === undefined || objectId === undefined) {
    throw new Error('Need to specify objectType and objectId');
  }
  if (tag.indexOf(':') !== -1 && !includeTypes) {
    return;
  }
  SupersetClient.post({
    endpoint: `/tagview/tags/${objectType}/${objectId}/`,
    body: JSON.stringify([tag]),
    parseMethod: 'text',
  })
    .then(({ text }) => callback(text))
    .catch(response => error(response));
}

export function fetchObjects(
  { tags = '', types }: { tags: string; types: string | null },
  callback: (json: JsonObject) => void,
  error: (response: Response) => void,
) {
  let url = `/tagview/tagged_objects/?tags=${tags}`;
  if (types) {
    url += `&types=${types}`;
  }
  SupersetClient.get({ endpoint: url })
    .then(({ json }) => callback(json))
    .catch(response => error(response));
}

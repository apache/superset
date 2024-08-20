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
import rison from 'rison';
import Tag from 'src/types/TagType';

export const OBJECT_TYPES_VALUES = Object.freeze([
  'dashboard',
  'chart',
  'saved_query',
]);

export const OBJECT_TYPES = Object.freeze({
  DASHBOARD: 'dashboard',
  CHART: 'chart',
  QUERY: 'saved_query',
});

const OBJECT_TYPE_ID_MAP = {
  saved_query: 1,
  chart: 2,
  dashboard: 3,
};

const map_object_type_to_id = (objectType: string) => {
  if (!OBJECT_TYPES_VALUES.includes(objectType)) {
    const msg = `objectType ${objectType} is invalid`;
    throw new Error(msg);
  }
  return OBJECT_TYPE_ID_MAP[objectType];
};

export function fetchAllTags(
  // fetch all tags (excluding system tags)
  callback: (json: JsonObject) => void,
  error: (response: Response) => void,
) {
  SupersetClient.get({
    endpoint: `/api/v1/tag/?q=${rison.encode({
      filters: [{ col: 'type', opr: 'custom_tag', value: true }],
    })}`,
  })
    .then(({ json }) => callback(json))
    .catch(response => error(response));
}

export function fetchSingleTag(
  id: number,
  callback: (json: JsonObject) => void,
  error: (response: Response) => void,
) {
  SupersetClient.get({ endpoint: `/api/v1/tag/${id}` })
    .then(({ json }) => callback(json.result))
    .catch(response => error(response));
}

export function fetchTags(
  {
    objectType,
    objectId,
    includeTypes = false,
  }: {
    objectType: string;
    objectId: number;
    includeTypes: boolean;
  },
  callback: (json: JsonObject) => void,
  error: (response: Response) => void,
) {
  if (objectType === undefined || objectId === undefined) {
    throw new Error('Need to specify objectType and objectId');
  }
  if (!OBJECT_TYPES_VALUES.includes(objectType)) {
    const msg = `objectType ${objectType} is invalid`;
    throw new Error(msg);
  }
  SupersetClient.get({
    endpoint: `/api/v1/${objectType}/${objectId}`,
  })
    .then(({ json }) =>
      callback(json.result.tags.filter((tag: Tag) => tag.type === 1)),
    )
    .catch(response => error(response));
}
export function deleteTaggedObjects(
  { objectType, objectId }: { objectType: string; objectId: number },
  tag: Tag,
  callback: (text: string) => void,
  error: (response: string) => void,
) {
  if (objectType === undefined || objectId === undefined) {
    throw new Error('Need to specify objectType and objectId');
  }
  if (!OBJECT_TYPES_VALUES.includes(objectType)) {
    const msg = `objectType ${objectType} is invalid`;
    throw new Error(msg);
  }
  SupersetClient.delete({
    endpoint: `/api/v1/tag/${map_object_type_to_id(objectType)}/${objectId}/${
      tag.name
    }`,
  })
    .then(({ json }) =>
      json
        ? callback(JSON.stringify(json))
        : callback('Successfully Deleted Tagged Objects'),
    )
    .catch(response => {
      const err_str = response.message;
      return err_str ? error(err_str) : error('Error Deleting Tagged Objects');
    });
}

export function deleteTags(
  tags: Tag[],
  callback: (text: string) => void,
  error: (response: string) => void,
) {
  const tag_names = tags.map(tag => tag.name) as string[];
  SupersetClient.delete({
    endpoint: `/api/v1/tag/?q=${rison.encode(tag_names)}`,
  })
    .then(({ json }) =>
      json.message
        ? callback(json.message)
        : callback('Successfully Deleted Tag'),
    )
    .catch(response => {
      const err_str = response.message;
      return err_str ? error(err_str) : error('Error Deleting Tag');
    });
}

export function addTag(
  {
    objectType,
    objectId,
    includeTypes = false,
  }: {
    objectType: string;
    objectId: number;
    includeTypes: boolean;
  },
  tag: string,
  callback: (text: string) => void,
  error: (response: Response) => void,
) {
  if (objectType === undefined || objectId === undefined) {
    throw new Error('Need to specify objectType and objectId');
  }
  const objectTypeId = map_object_type_to_id(objectType);
  SupersetClient.post({
    endpoint: `/api/v1/tag/${objectTypeId}/${objectId}/`,
    body: JSON.stringify({
      properties: {
        tags: [tag],
      },
    }),
    parseMethod: 'json',
    headers: { 'Content-Type': 'application/json' },
  })
    .then(({ json }) => callback(JSON.stringify(json)))
    .catch(response => error(response));
}

export function fetchObjects(
  { tags = '', types }: { tags: string; types: string | null },
  callback: (json: JsonObject) => void,
  error: (response: Response) => void,
) {
  let url = `/api/v1/tag/get_objects/?tags=${tags}`;
  if (types) {
    url += `&types=${types}`;
  }
  SupersetClient.get({ endpoint: url })
    .then(({ json }) => callback(json.result))
    .catch(response => error(response));
}

export function fetchObjectsByTagIds(
  {
    tagIds = [],
    types,
  }: { tagIds: number[] | undefined; types: string | null },
  callback: (json: JsonObject) => void,
  error: (response: Response) => void,
) {
  let url = `/api/v1/tag/get_objects/?tagIds=${tagIds}`;
  if (types) {
    url += `&types=${types}`;
  }
  SupersetClient.get({ endpoint: url })
    .then(({ json }) => callback(json.result))
    .catch(response => error(response));
}

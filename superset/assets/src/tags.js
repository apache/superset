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
import { SupersetClient } from '@superset-ui/connection';

export function fetchTags(options, callback, error) {
  if (options.objectType === undefined || options.objectId === undefined) {
    throw new Error('Need to specify objectType and objectId');
  }
  const objectType = options.objectType;
  const objectId = options.objectId;
  const includeTypes = options.includeTypes !== undefined ? options.includeTypes : false;

  SupersetClient.get({ endpoint: `/tagview/tags/${objectType}/${objectId}/` })
    .then(({ json }) => callback(
      json.filter(tag => tag.name.indexOf(':') === -1 || includeTypes)))
    .catch(response => error(response));
}

export function fetchSuggestions(options, callback, error) {
  const includeTypes = options.includeTypes !== undefined ? options.includeTypes : false;
  SupersetClient.get({ endpoint: '/tagview/tags/suggestions/' })
    .then(({ json }) => callback(
      json.filter(tag => tag.name.indexOf(':') === -1 || includeTypes)))
    .catch(response => error(response));
}

export function deleteTag(options, tag, callback, error) {
  if (options.objectType === undefined || options.objectId === undefined) {
    throw new Error('Need to specify objectType and objectId');
  }
  const objectType = options.objectType;
  const objectId = options.objectId;

  SupersetClient.post({
    endpoint: `/tagview/tags/${objectType}/${objectId}/`,
    postPayload: [tag],
  })
    .then(() => callback())
    .catch(response => error(response));
}

export function addTag(options, tag, callback, error) {
  if (options.objectType === undefined || options.objectId === undefined) {
    throw new Error('Need to specify objectType and objectId');
  }
  const objectType = options.objectType;
  const objectId = options.objectId;
  const includeTypes = options.includeTypes !== undefined ? options.includeTypes : false;

  if (tag.indexOf(':') !== -1 && !includeTypes) {
    return;
  }
  SupersetClient.post({
    endpoint: `/tagview/tags/${objectType}/${objectId}/`,
    postPayload: [tag],
  })
    .then(({ json }) => callback(json))
    .catch(response => error(response));
}

export function fetchObjects(options, callback, error) {
  const tags = options.tags !== undefined ? options.tags : '';
  const types = options.types;

  let url = `/tagview/tagged_objects/?tags=${tags}`;
  if (types) {
    url += `&types=${types}`;
  }
  SupersetClient.get({ endpoint: url })
    .then(({ json }) => callback(json))
    .catch(response => error(response));
}

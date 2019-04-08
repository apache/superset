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
import 'whatwg-fetch';
import { getCSRFToken } from './modules/utils';

export function fetchTags(options, callback, error) {
  if (options.objectType === undefined || options.objectId === undefined) {
    throw new Error('Need to specify objectType and objectId');
  }
  const objectType = options.objectType;
  const objectId = options.objectId;
  const includeTypes = options.includeTypes !== undefined ? options.includeTypes : false;

  const url = `/tagview/tags/${objectType}/${objectId}/`;
  window.fetch(url)
    .then((response) => {
      if (response.ok) {
        return response.json();
      }
      throw new Error(response.text());
    })
    .then(json => callback(
      json.filter(tag => tag.name.indexOf(':') === -1 || includeTypes)))
    .catch(text => error(text));
}

export function fetchSuggestions(options, callback, error) {
  const includeTypes = options.includeTypes !== undefined ? options.includeTypes : false;
  window.fetch('/tagview/tags/suggestions/')
    .then((response) => {
      if (response.ok) {
        return response.json();
      }
      throw new Error(response.text());
    })
    .then(json => callback(
      json.filter(tag => tag.name.indexOf(':') === -1 || includeTypes)))
    .catch(text => error(text));
}

export function deleteTag(options, tag, callback, error) {
  if (options.objectType === undefined || options.objectId === undefined) {
    throw new Error('Need to specify objectType and objectId');
  }
  const objectType = options.objectType;
  const objectId = options.objectId;

  const url = `/tagview/tags/${objectType}/${objectId}/`;
  const CSRF_TOKEN = getCSRFToken();
  window.fetch(url, {
    body: JSON.stringify([tag]),
    headers: {
      'content-type': 'application/json',
      'X-CSRFToken': CSRF_TOKEN,
    },
    credentials: 'same-origin',
    method: 'DELETE',
  })
  .then((response) => {
    if (response.ok) {
      callback(response.text());
    } else {
      error(response.text());
    }
  });
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
  const url = `/tagview/tags/${objectType}/${objectId}/`;
  const CSRF_TOKEN = getCSRFToken();
  window.fetch(url, {
    body: JSON.stringify([tag]),
    headers: {
      'content-type': 'application/json',
      'X-CSRFToken': CSRF_TOKEN,
    },
    credentials: 'same-origin',
    method: 'POST',
  })
  .then((response) => {
    if (response.ok) {
      callback(response.text());
    } else {
      error(response.text());
    }
  });
}

export function fetchObjects(options, callback) {
  const tags = options.tags !== undefined ? options.tags : '';
  const types = options.types;

  let url = `/tagview/tagged_objects/?tags=${tags}`;
  if (types) {
    url += `&types=${types}`;
  }
  const CSRF_TOKEN = getCSRFToken();
  window.fetch(url, {
    headers: {
      'X-CSRFToken': CSRF_TOKEN,
    },
    credentials: 'same-origin',
  })
    .then(response => response.json())
    .then(json => callback(json));
}

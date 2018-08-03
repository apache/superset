import 'whatwg-fetch';
import { getCSRFToken } from './modules/utils';

export function fetchTags(objectType, objectId, includeTypes, callback) {
  const url = `/tagview/tags/${objectType}/${objectId}/`;
  window.fetch(url)
    .then(response => response.json())
    .then(json => callback(
      json.filter(tag => tag.name.indexOf(':') === -1 || includeTypes)));
}

export function fetchSuggestions(includeTypes, callback) {
  window.fetch('/tagview/tags/suggestions/')
    .then(response => response.json())
    .then(json => callback(
      json.filter(tag => tag.name.indexOf(':') === -1 || includeTypes)));
}

export function deleteTag(objectType, objectId, tag, callback, error) {
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
      callback(response);
    } else {
      error(response);
    }
  });
}

export function addTag(objectType, objectId, includeTypes, tag, callback, error) {
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
      callback(response);
    } else {
      error(response);
    }
  });
}

export function fetchObjects(tags, types, callback) {
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

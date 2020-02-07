import URI from 'urijs';
import { safeStringify } from './safeStringify';

const MAX_URL_LENGTH = 8000;

export function getURIDirectory(formData, endpointType = 'base') {
  // Building the directory part of the URI
  let directory = '/superset/explore/';
  if (['json', 'csv', 'query', 'results', 'samples'].includes(endpointType)) {
    directory = '/superset/explore_json/';
  }

  return directory;
}

export function getExploreLongUrl(formData, endpointType, allowOverflow = true, extraSearch = {}) {
  if (!formData.datasource) {
    return null;
  }

  const uri = new URI('/');
  const directory = getURIDirectory(formData, endpointType);
  const search = uri.search(true);
  Object.keys(extraSearch).forEach(key => {
    search[key] = extraSearch[key];
  });
  search.form_data = safeStringify(formData);
  if (endpointType === 'standalone') {
    search.standalone = 'true';
  }
  const url = uri
    .directory(directory)
    .search(search)
    .toString();
  if (!allowOverflow && url.length > MAX_URL_LENGTH) {
    const minimalFormData = {
      datasource: formData.datasource,
      viz_type: formData.viz_type,
    };

    return getExploreLongUrl(minimalFormData, endpointType, false, {
      URL_IS_TOO_LONG_TO_SHARE: null,
    });
  }

  return url;
}

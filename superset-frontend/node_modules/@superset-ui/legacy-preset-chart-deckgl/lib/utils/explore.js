"use strict";

exports.__esModule = true;
exports.getURIDirectory = getURIDirectory;
exports.getExploreLongUrl = getExploreLongUrl;

var _urijs = _interopRequireDefault(require("urijs"));

var _safeStringify = require("./safeStringify");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const MAX_URL_LENGTH = 8000;

function getURIDirectory(formData, endpointType) {
  if (endpointType === void 0) {
    endpointType = 'base';
  }

  // Building the directory part of the URI
  let directory = '/superset/explore/';

  if (['json', 'csv', 'query', 'results', 'samples'].includes(endpointType)) {
    directory = '/superset/explore_json/';
  }

  return directory;
}

function getExploreLongUrl(formData, endpointType, allowOverflow, extraSearch) {
  if (allowOverflow === void 0) {
    allowOverflow = true;
  }

  if (extraSearch === void 0) {
    extraSearch = {};
  }

  if (!formData.datasource) {
    return null;
  }

  const uri = new _urijs.default('/');
  const directory = getURIDirectory(formData, endpointType);
  const search = uri.search(true);
  Object.keys(extraSearch).forEach(key => {
    search[key] = extraSearch[key];
  });
  search.form_data = (0, _safeStringify.safeStringify)(formData);

  if (endpointType === 'standalone') {
    search.standalone = 'true';
  }

  const url = uri.directory(directory).search(search).toString();

  if (!allowOverflow && url.length > MAX_URL_LENGTH) {
    const minimalFormData = {
      datasource: formData.datasource,
      viz_type: formData.viz_type
    };
    return getExploreLongUrl(minimalFormData, endpointType, false, {
      URL_IS_TOO_LONG_TO_SHARE: null
    });
  }

  return url;
}
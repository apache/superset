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

import { useCallback, useEffect } from 'react';
import { omit } from 'lodash';
/* eslint camelcase: 0 */
import URI from 'urijs';
import {
  buildQueryContext,
  ensureIsArray,
  getChartBuildQueryRegistry,
  getChartMetadataRegistry,
} from '@superset-ui/core';
import { availableDomains } from 'src/utils/hostNamesConfig';
import { safeStringify } from 'src/utils/safeStringify';
import { URL_PARAMS } from 'src/constants';
import {
  MULTI_OPERATORS,
  OPERATOR_ENUM_TO_OPERATOR_TYPE,
} from 'src/explore/constants';
import { DashboardStandaloneMode } from 'src/dashboard/util/constants';

const MAX_URL_LENGTH = 8000;

export function getChartKey(explore) {
  const { slice } = explore;
  return slice ? slice.slice_id : 0;
}

let requestCounter = 0;
export function getHostName(allowDomainSharding = false) {
  let currentIndex = 0;
  if (allowDomainSharding) {
    currentIndex = requestCounter % availableDomains.length;
    requestCounter += 1;

    // if domain sharding is enabled, skip main domain for fetching chart API
    // leave main domain free for other calls like fav star, save change, etc.
    // to make dashboard be responsive when it's loading large number of charts
    if (currentIndex === 0) {
      currentIndex += 1;
      requestCounter += 1;
    }
  }
  return availableDomains[currentIndex];
}

export function getAnnotationJsonUrl(slice_id, form_data, isNative, force) {
  if (slice_id === null || slice_id === undefined) {
    return null;
  }
  const uri = URI(window.location.search);
  const endpoint = isNative ? 'annotation_json' : 'slice_json';
  return uri
    .pathname(`/superset/${endpoint}/${slice_id}`)
    .search({
      form_data: safeStringify(form_data, (key, value) =>
        value === null ? undefined : value,
      ),
      force,
    })
    .toString();
}

export function getURIDirectory(endpointType = 'base') {
  // Building the directory part of the URI
  if (
    ['full', 'json', 'csv', 'query', 'results', 'samples'].includes(
      endpointType,
    )
  ) {
    return '/superset/explore_json/';
  }
  return '/superset/explore/';
}

/**
 * This gets the url of the explore page, with all the form data included explicitly.
 * This includes any form data overrides from the dashboard.
 */
export function getExploreLongUrl(
  formData,
  endpointType,
  allowOverflow = true,
  extraSearch = {},
) {
  if (!formData.datasource) {
    return null;
  }

  const uri = new URI('/');
  const directory = getURIDirectory(endpointType);
  const search = uri.search(true);
  Object.keys(extraSearch).forEach(key => {
    search[key] = extraSearch[key];
  });
  search.form_data = safeStringify(formData);
  if (endpointType === URL_PARAMS.standalone.name) {
    search.standalone = DashboardStandaloneMode.HIDE_NAV;
  }
  const url = uri.directory(directory).search(search).toString();
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

export function getExploreUrlFromDashboard(formData) {
  // remove formData params that we don't need in the explore url.
  // These are present when generating explore urls from the dashboard page.
  // This should be superseded by some sort of "exploration context" system
  // where form data and other context is referenced by id.
  const trimmedFormData = omit(formData, [
    'dataMask',
    'url_params',
    'label_colors',
  ]);
  return getExploreLongUrl(trimmedFormData, null, false);
}

export function getChartDataUri({ path, qs, allowDomainSharding = false }) {
  // The search params from the window.location are carried through,
  // but can be specified with curUrl (used for unit tests to spoof
  // the window.location).
  let uri = new URI({
    protocol: window.location.protocol.slice(0, -1),
    hostname: getHostName(allowDomainSharding),
    port: window.location.port ? window.location.port : '',
    path,
  });
  if (qs) {
    uri = uri.search(qs);
  }
  return uri;
}

/**
 * This gets the minimal url for the given form data.
 * If there are dashboard overrides present in the form data,
 * they will not be included in the url.
 */
export function getExploreUrl({
  formData,
  endpointType = 'base',
  force = false,
  curUrl = null,
  requestParams = {},
  allowDomainSharding = false,
  method = 'POST',
}) {
  if (!formData.datasource) {
    return null;
  }

  // label_colors should not pollute the URL
  // eslint-disable-next-line no-param-reassign
  delete formData.label_colors;

  let uri = getChartDataUri({ path: '/', allowDomainSharding });
  if (curUrl) {
    uri = URI(URI(curUrl).search());
  }

  const directory = getURIDirectory(endpointType);

  // Building the querystring (search) part of the URI
  const search = uri.search(true);
  const { slice_id, extra_filters, adhoc_filters, viz_type } = formData;
  if (slice_id) {
    const form_data = { slice_id };
    if (method === 'GET') {
      form_data.viz_type = viz_type;
      if (extra_filters && extra_filters.length) {
        form_data.extra_filters = extra_filters;
      }
      if (adhoc_filters && adhoc_filters.length) {
        form_data.adhoc_filters = adhoc_filters;
      }
    }
    search.form_data = safeStringify(form_data);
  }
  if (force) {
    search.force = 'true';
  }
  if (endpointType === 'csv') {
    search.csv = 'true';
  }
  if (endpointType === URL_PARAMS.standalone.name) {
    search.standalone = '1';
  }
  if (endpointType === 'query') {
    search.query = 'true';
  }
  if (endpointType === 'results') {
    search.results = 'true';
  }
  if (endpointType === 'samples') {
    search.samples = 'true';
  }
  const paramNames = Object.keys(requestParams);
  if (paramNames.length) {
    paramNames.forEach(name => {
      if (requestParams.hasOwnProperty(name)) {
        search[name] = requestParams[name];
      }
    });
  }
  return uri.search(search).directory(directory).toString();
}

export const shouldUseLegacyApi = formData => {
  const vizMetadata = getChartMetadataRegistry().get(formData.viz_type);
  return vizMetadata ? vizMetadata.useLegacyApi : false;
};

export const buildV1ChartDataPayload = ({
  formData,
  force,
  resultFormat,
  resultType,
  setDataMask,
  ownState,
}) => {
  const buildQuery =
    getChartBuildQueryRegistry().get(formData.viz_type) ??
    (buildQueryformData =>
      buildQueryContext(buildQueryformData, baseQueryObject => [
        {
          ...baseQueryObject,
        },
      ]));
  return buildQuery(
    {
      ...formData,
      force,
      result_format: resultFormat,
      result_type: resultType,
    },
    {
      ownState,
      hooks: {
        setDataMask,
      },
    },
  );
};

export const getLegacyEndpointType = ({ resultType, resultFormat }) =>
  resultFormat === 'csv' ? resultFormat : resultType;

export function postForm(url, payload, target = '_blank') {
  if (!url) {
    return;
  }

  const hiddenForm = document.createElement('form');
  hiddenForm.action = url;
  hiddenForm.method = 'POST';
  hiddenForm.target = target;
  const token = document.createElement('input');
  token.type = 'hidden';
  token.name = 'csrf_token';
  token.value = (document.getElementById('csrf_token') || {}).value;
  hiddenForm.appendChild(token);
  const data = document.createElement('input');
  data.type = 'hidden';
  data.name = 'form_data';
  data.value = safeStringify(payload);
  hiddenForm.appendChild(data);

  document.body.appendChild(hiddenForm);
  hiddenForm.submit();
  document.body.removeChild(hiddenForm);
}

export const exportChart = ({
  formData,
  resultFormat = 'json',
  resultType = 'full',
  force = false,
  ownState = {},
}) => {
  let url;
  let payload;
  if (shouldUseLegacyApi(formData)) {
    const endpointType = getLegacyEndpointType({ resultFormat, resultType });
    url = getExploreUrl({
      formData,
      endpointType,
      allowDomainSharding: false,
    });
    payload = formData;
  } else {
    url = '/api/v1/chart/data';
    payload = buildV1ChartDataPayload({
      formData,
      force,
      resultFormat,
      resultType,
      ownState,
    });
  }
  postForm(url, payload);
};

export const exploreChart = formData => {
  const url = getExploreUrl({
    formData,
    endpointType: 'base',
    allowDomainSharding: false,
  });
  postForm(url, formData);
};

export const useDebouncedEffect = (effect, delay, deps) => {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const callback = useCallback(effect, deps);

  useEffect(() => {
    const handler = setTimeout(() => {
      callback();
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [callback, delay]);
};

export const getSimpleSQLExpression = (subject, operator, comparator) => {
  const isMulti =
    [...MULTI_OPERATORS]
      .map(op => OPERATOR_ENUM_TO_OPERATOR_TYPE[op].operation)
      .indexOf(operator) >= 0;
  let expression = subject ?? '';
  if (subject && operator) {
    expression += ` ${operator}`;
    const firstValue =
      isMulti && Array.isArray(comparator) ? comparator[0] : comparator;
    const comparatorArray = ensureIsArray(comparator);
    const isString =
      firstValue !== undefined && Number.isNaN(Number(firstValue));
    const quote = isString ? "'" : '';
    const [prefix, suffix] = isMulti ? ['(', ')'] : ['', ''];
    const formattedComparators = comparatorArray.map(
      val =>
        `${quote}${isString ? String(val).replace("'", "''") : val}${quote}`,
    );
    if (comparatorArray.length > 0) {
      expression += ` ${prefix}${formattedComparators.join(', ')}${suffix}`;
    }
  }
  return expression;
};

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

export interface Location {
  search: string;
  pathname: string;
}

type ExploreUrlSearchParamsWithParser = 'form_data' | 'datasource';

// mapping { url_param: v1_explore_request_param }
const EXPLORE_URL_SEARCH_PARAMS = {
  form_data: {
    name: 'form_data',
    parser: (formData: string) => {
      const formDataObject = JSON.parse(formData);
      if (formDataObject.datasource) {
        const [datasource_id, datasource_type] =
          formDataObject.datasource.split('__');
        formDataObject.datasource_id = datasource_id;
        formDataObject.datasource_type = datasource_type;
        delete formDataObject.datasource;
      }
      return formDataObject;
    },
  },
  slice_id: {
    name: 'slice_id',
  },
  datasource_id: {
    name: 'datasource_id',
  },
  datasource_type: {
    name: 'datasource_type',
  },
  datasource: {
    name: 'datasource',
    parser: (datasource: string) => {
      const [datasource_id, datasource_type] = datasource.split('__');
      return { datasource_id, datasource_type };
    },
  },
  form_data_key: {
    name: 'form_data_key',
  },
  permalink_key: {
    name: 'permalink_key',
  },
  viz_type: {
    name: 'viz_type',
  },
  dashboard_id: {
    name: 'dashboard_id',
  },
};

const EXPLORE_URL_PATH_PARAMS = {
  p: 'permalink_key', // permalink
  table: 'datasource_id',
};

// search params can be placed in form_data object
// we need to "flatten" the search params to use them with /v1/explore endpoint
const getParsedExploreURLSearchParams = (
  search: string,
): Record<string, any> => {
  const urlSearchParams = new URLSearchParams(search);
  return Array.from(urlSearchParams.keys()).reduce<Record<string, any>>(
    (acc, currentParam) => {
      const paramValue = urlSearchParams.get(currentParam);
      if (paramValue === null) {
        return acc;
      }
      let parsedParamValue;
      try {
        parsedParamValue =
          EXPLORE_URL_SEARCH_PARAMS[
            currentParam as ExploreUrlSearchParamsWithParser
          ].parser?.(paramValue) ?? paramValue;
      } catch {
        parsedParamValue = paramValue;
      }
      if (typeof parsedParamValue === 'object') {
        return { ...acc, ...parsedParamValue };
      }
      const key =
        EXPLORE_URL_SEARCH_PARAMS[
          currentParam as keyof typeof EXPLORE_URL_SEARCH_PARAMS
        ]?.name || currentParam;
      return {
        ...acc,
        [key]: parsedParamValue,
      };
    },
    {},
  );
};

// path params need to be transformed to search params to use them with /v1/explore endpoint
const getParsedExploreURLPathParams = (pathname: string) =>
  Object.keys(EXPLORE_URL_PATH_PARAMS).reduce((acc, currentParam) => {
    const re = new RegExp(`/(${currentParam})/(\\w+)`);
    const pathGroups = pathname.match(re);
    if (pathGroups?.[2]) {
      return {
        ...acc,
        [EXPLORE_URL_PATH_PARAMS[
          currentParam as keyof typeof EXPLORE_URL_PATH_PARAMS
        ]]: pathGroups[2],
      };
    }
    return acc;
  }, {});

export const getParsedExploreURLParams = (
  location: Location = window.location,
) =>
  new URLSearchParams(
    Object.entries({
      ...getParsedExploreURLSearchParams(location.search),
      ...getParsedExploreURLPathParams(location.pathname),
    })
      .map(entry => entry.join('='))
      .join('&'),
  );

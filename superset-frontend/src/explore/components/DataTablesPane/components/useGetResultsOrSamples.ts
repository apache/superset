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
import { useState, useEffect } from 'react';
import { t, ensureIsArray } from '@superset-ui/core';
import { getChartDataRequest } from 'src/components/Chart/chartAction';
import { getClientErrorObject } from 'src/utils/getClientErrorObject';
import { requestPayload, responseData } from '../types';

const cache = new WeakMap();

export function useGetResultsOrSamples({
  isRequest,
  resultType,
  queryFormData,
  datasource,
  queryForce,
  ownState,
  actions,
}: requestPayload): responseData {
  // todo: this hook should split into useGetResults and useGetSamples after change endpoint
  const [response, setResponse] = useState<responseData>({
    isLoading: false,
    colnames: [],
    coltypes: [],
    data: [],
    responseError: '',
  });
  const cacheKey = resultType === 'samples' ? datasource || {} : queryFormData;

  useEffect(() => {
    setResponse({
      ...response,
      isLoading: true,
    });
    if (queryForce && cache.has(cacheKey)) {
      cache.delete(cacheKey);
    }

    if (cache.has(cacheKey)) {
      setResponse(cache.get(cacheKey));
    }
    if (isRequest && !cache.has(cacheKey)) {
      getChartDataRequest({
        formData: queryFormData,
        force: queryForce,
        resultFormat: 'json',
        resultType,
        ownState,
      })
        .then(({ json }) => {
          const { colnames, coltypes } = json.result[0];
          // Only displaying the first query is currently supported
          if (json.result.length > 1) {
            // todo: move these code to the backend, shouldn't loop by row in FE
            const data: any[] = [];
            json.result.forEach((item: { data: any[] }) => {
              item.data.forEach((row, i) => {
                if (data[i] !== undefined) {
                  data[i] = { ...data[i], ...row };
                } else {
                  data[i] = row;
                }
              });
            });
            const rv = {
              ...response,
              isLoading: false,
              data,
              colnames,
              coltypes,
              responseError: '',
            };
            // to save only latest results
            cache.set(cacheKey, rv);
            setResponse(rv);
          } else {
            const rv = {
              ...response,
              isLoading: false,
              // legacy api may be NULL
              data: ensureIsArray(json.result[0].data),
              colnames,
              coltypes,
              responseError: '',
            };
            cache.set(cacheKey, rv);
            setResponse(rv);
          }
          if (queryForce && actions) {
            actions.setForceQuery(false);
          }
        })
        .catch(response => {
          getClientErrorObject(response).then(({ error, message }) => {
            setResponse({
              ...response,
              isLoading: false,
              responseError: error || message || t('Sorry, an error occurred'),
            });
          });
        });
    }
  }, [queryFormData, datasource, ownState, isRequest]);

  return response;
}

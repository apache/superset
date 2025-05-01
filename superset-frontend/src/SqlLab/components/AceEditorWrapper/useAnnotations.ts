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
import { useSelector } from 'react-redux';

import { COMMON_ERR_MESSAGES, ClientErrorObject, t } from '@superset-ui/core';
import { SqlLabRootState } from 'src/SqlLab/types';
import { VALIDATION_DEBOUNCE_MS } from 'src/SqlLab/constants';
import {
  FetchValidationQueryParams,
  useQueryValidationsQuery,
  ValidationResult,
} from 'src/hooks/apiResources';
import { useDebounceValue } from 'src/hooks/useDebounceValue';

const EMPTY = [] as ValidationResult[];

export function useAnnotations(params: FetchValidationQueryParams) {
  const { sql, dbId, schema, templateParams } = params;
  const debouncedSql = useDebounceValue(sql, VALIDATION_DEBOUNCE_MS);
  const hasValidator = useSelector<SqlLabRootState>(({ sqlLab, common }) =>
    // Check whether or not we can validate the current query based on whether
    // or not the backend has a validator configured for it.
    Boolean(
      common?.conf?.SQL_VALIDATORS_BY_ENGINE?.[
        sqlLab?.databases?.[dbId || '']?.backend
      ],
    ),
  );
  return useQueryValidationsQuery(
    {
      dbId,
      schema,
      sql: debouncedSql,
      templateParams,
    },
    {
      skip: !(hasValidator && dbId && sql),
      selectFromResult: ({ isLoading, isError, error, data }) => {
        const errorObj = (error ?? {}) as ClientErrorObject;
        let message =
          errorObj?.error || errorObj?.statusText || t('Unknown error');
        if (message.includes('CSRF token')) {
          message = t(COMMON_ERR_MESSAGES.SESSION_TIMED_OUT);
        }
        return {
          data:
            !isLoading && data?.length
              ? data.map(err => ({
                  type: 'error',
                  row: (err.line_number || 0) - 1,
                  column: (err.start_column || 0) - 1,
                  text: err.message,
                }))
              : isError
                ? [
                    {
                      type: 'error',
                      row: 0,
                      column: 0,
                      text: `The server failed to validate your query.\n${message}`,
                    },
                  ]
                : EMPTY,
        };
      },
    },
  );
}

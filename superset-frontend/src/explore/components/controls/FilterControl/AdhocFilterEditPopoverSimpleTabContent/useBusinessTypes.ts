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
import { useCallback, useState } from 'react';
import { ensureIsArray, SupersetClient, t } from '@superset-ui/core';
import { debounce } from 'lodash';
import rison from 'rison';
import { BusinessTypesState, Props } from './index';

const INITIAL_BUSINESS_TYPES_STATE: BusinessTypesState = {
  parsedBusinessType: '',
  businessTypeOperatorList: [],
  errorMessage: '',
};

const useBusinessTypes = (validHandler: (isValid: boolean) => void) => {
  const [businessTypesState, setBusinessTypesState] =
    useState<BusinessTypesState>(INITIAL_BUSINESS_TYPES_STATE);
  const [subjectBusinessType, setSubjectBusinessType] = useState<
    string | undefined
  >();

  const fetchBusinessTypeValueCallback = useCallback(
    (
      comp: string | string[],
      businessTypesState: BusinessTypesState,
      subjectBusinessType?: string,
    ) => {
      const values = ensureIsArray(comp);
      console.log(values);
      console.log(subjectBusinessType);
      if (!subjectBusinessType) {
        setBusinessTypesState(INITIAL_BUSINESS_TYPES_STATE);
        return;
      }
      debounce(() => {
        const queryParams = rison.encode({ type: subjectBusinessType, values });
        const endpoint = `/api/v1/business_type/convert?q=${queryParams}`;
        SupersetClient.get({ endpoint })
          .then(({ json }) => {
            setBusinessTypesState({
              parsedBusinessType: json.result.display_value,
              businessTypeOperatorList: json.result.valid_filter_operators,
              errorMessage: json.result.error_message,
            });
            // Changed due to removal of status field
            validHandler(!json.result.error_message);
          })
          .catch(() => {
            setBusinessTypesState({
              parsedBusinessType: '',
              businessTypeOperatorList:
                businessTypesState.businessTypeOperatorList,
              errorMessage: t('Failed to retrieve business types'),
            });
            validHandler(false);
          });
      }, 600)();
    },
    [validHandler],
  );

  const fetchSubjectBusinessType = (props: Props) => {
    const option = props.options.find(
      option =>
        ('column_name' in option &&
          option.column_name === props.adhocFilter.subject) ||
        ('optionName' in option &&
          option.optionName === props.adhocFilter.subject),
    );
    if (option && 'business_type' in option) {
      setSubjectBusinessType(option.business_type);
    } else {
      props.validHandler(true);
    }
  };

  return {
    businessTypesState,
    subjectBusinessType,
    setBusinessTypesState,
    fetchBusinessTypeValueCallback,
    fetchSubjectBusinessType,
  };
};

export default useBusinessTypes;

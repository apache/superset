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
import { AdvancedDataTypesState, Props } from './index';

const INITIAL_ADVANCED_DATA_TYPES_STATE: AdvancedDataTypesState = {
  parsedAdvancedDataType: '',
  advancedDataTypeOperatorList: [],
  errorMessage: '',
};

const useAdvancedDataTypes = (validHandler: (isValid: boolean) => void) => {
  const [advancedDataTypesState, setAdvancedDataTypesState] =
    useState<AdvancedDataTypesState>(INITIAL_ADVANCED_DATA_TYPES_STATE);
  const [subjectAdvancedDataType, setSubjectAdvancedDataType] = useState<
    string | undefined
  >();

  const fetchAdvancedDataTypeValueCallback = useCallback(
    (
      comp: string | string[],
      advancedDataTypesState: AdvancedDataTypesState,
      subjectAdvancedDataType?: string,
    ) => {
      const values = ensureIsArray(comp);
      if (!subjectAdvancedDataType) {
        setAdvancedDataTypesState(INITIAL_ADVANCED_DATA_TYPES_STATE);
        return;
      }
      debounce(() => {
        const queryParams = rison.encode({
          type: subjectAdvancedDataType,
          values,
        });
        const endpoint = `/api/v1/advanced_data_type/convert?q=${queryParams}`;
        SupersetClient.get({ endpoint })
          .then(({ json }) => {
            setAdvancedDataTypesState({
              parsedAdvancedDataType: json.result.display_value,
              advancedDataTypeOperatorList: json.result.valid_filter_operators,
              errorMessage: json.result.error_message,
            });
            // Changed due to removal of status field
            validHandler(!json.result.error_message);
          })
          .catch(() => {
            setAdvancedDataTypesState({
              parsedAdvancedDataType: '',
              advancedDataTypeOperatorList:
                advancedDataTypesState.advancedDataTypeOperatorList,
              errorMessage: t('Failed to retrieve advanced type'),
            });
            validHandler(false);
          });
      }, 600)();
    },
    [validHandler],
  );

  const fetchSubjectAdvancedDataType = (props: Props) => {
    const option = props.options.find(
      option =>
        ('column_name' in option &&
          option.column_name === props.adhocFilter.subject) ||
        ('optionName' in option &&
          option.optionName === props.adhocFilter.subject),
    );
    if (option && 'advanced_data_type' in option) {
      setSubjectAdvancedDataType(option.advanced_data_type);
    } else {
      props.validHandler(true);
    }
  };

  return {
    advancedDataTypesState,
    subjectAdvancedDataType,
    setAdvancedDataTypesState,
    fetchAdvancedDataTypeValueCallback,
    fetchSubjectAdvancedDataType,
  };
};

export default useAdvancedDataTypes;

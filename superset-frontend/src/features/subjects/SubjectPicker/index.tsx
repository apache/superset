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
import { type ReactNode, useCallback } from 'react';
import { SupersetClient } from '@superset-ui/core';
import { AsyncSelect } from '@superset-ui/core/components';
import rison from 'rison';
import { SUBJECT_OPTION_FILTER_PROPS } from 'src/features/subjects/SubjectSelectLabel';
import {
  mergeSubjectPickerValues,
  normalizeSubjectToPickerValue,
  type SubjectPickerValue,
} from './utils';

export {
  mapPickerValuesToSubjects,
  mapSubjectPickerValuesToIds,
  mapSubjectValuesToIds,
  mapSubjectsToPickerValues,
  normalizeSubjectToPickerValue,
  normalizeSubjectsToPickerValues,
} from './utils';
export type { SubjectPickerSource, SubjectPickerValue } from './utils';

interface SubjectPickerProps {
  /** Related API URL, e.g. '/api/v1/dashboard/related/editors' */
  relatedUrl: string;
  /** Currently selected subjects */
  value: SubjectPickerValue[];
  /** Called when the selection changes */
  onChange: (values: SubjectPickerValue[]) => void;
  /** Accessible label */
  ariaLabel: string;
  /** Placeholder text */
  placeholder?: string;
  /** Whether the picker is disabled */
  disabled?: boolean;
  /** Whether to allow clearing */
  allowClear?: boolean;
  /** Header element (e.g. FormLabel) */
  header?: ReactNode;
  /** data-test attribute */
  dataTest?: string;
}

const SubjectPicker = ({
  relatedUrl,
  value,
  onChange,
  ariaLabel,
  placeholder,
  disabled,
  allowClear,
  header,
  dataTest,
}: SubjectPickerProps) => {
  const handleChange = useCallback(
    (
      values: SubjectPickerValue[],
      options?: SubjectPickerValue | SubjectPickerValue[],
    ) => {
      onChange(
        mergeSubjectPickerValues(
          values,
          Array.isArray(options) ? options : options ? [options] : [],
        ),
      );
    },
    [onChange],
  );

  const loadOptions = useCallback(
    (input = '', page: number, pageSize: number) => {
      const query = rison.encode({
        filter: input,
        page,
        page_size: pageSize,
      });
      return SupersetClient.get({
        endpoint: `${relatedUrl}?q=${query}`,
      }).then(response => ({
        data: response.json.result
          .filter((item: { extra: { active?: boolean } }) =>
            item.extra.active !== undefined ? item.extra.active : true,
          )
          .flatMap(
            (item: {
              value: number;
              text: string;
              extra: { type?: number; secondary_label?: string };
            }) => {
              const value = normalizeSubjectToPickerValue({
                value: item.value,
                text: item.text,
                type: item.extra?.type,
                secondary_label: item.extra?.secondary_label,
              });
              return value ? [value] : [];
            },
          ),
        totalCount: response.json.count,
      }));
    },
    [relatedUrl],
  );

  return (
    <AsyncSelect
      ariaLabel={ariaLabel}
      mode="multiple"
      value={value}
      options={loadOptions}
      onChange={handleChange}
      placeholder={placeholder}
      disabled={disabled}
      allowClear={allowClear}
      header={header}
      data-test={dataTest}
      optionFilterProps={SUBJECT_OPTION_FILTER_PROPS}
    />
  );
};

export default SubjectPicker;

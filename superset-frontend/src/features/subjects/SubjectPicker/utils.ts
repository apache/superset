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
import type { ReactNode } from 'react';
import { SubjectType } from 'src/types/Subject';
import type Subject from 'src/types/Subject';
import {
  SubjectSelectLabel,
  SUBJECT_TEXT_LABEL_PROP,
  SUBJECT_DETAIL_PROP,
} from 'src/features/subjects/SubjectSelectLabel';

export interface SubjectPickerValue {
  value: number;
  label: ReactNode;
  type?: SubjectType;
  secondary_label?: string;
  [key: string]: unknown;
}

const getTextLabel = (value: SubjectPickerValue) => {
  const textLabel = value[SUBJECT_TEXT_LABEL_PROP];
  if (typeof textLabel === 'string') {
    return textLabel;
  }
  return typeof value.label === 'string' ? value.label : '';
};

const getDetail = (value: SubjectPickerValue) => {
  const detail = value[SUBJECT_DETAIL_PROP] ?? value.secondary_label;
  return typeof detail === 'string' ? detail : '';
};

/**
 * Converts an array of Subject model objects into SubjectPickerValue[]
 * suitable for use as the `value` prop of SubjectPicker.
 */
export function mapSubjectsToPickerValues(
  subjects: Subject[],
): SubjectPickerValue[] {
  return subjects.map(subject => ({
    value: subject.id,
    label: SubjectSelectLabel({
      label: subject.label ?? '',
      type: subject.type,
      secondaryLabel: subject.secondary_label,
    }),
    type: subject.type,
    secondary_label: subject.secondary_label,
    [SUBJECT_TEXT_LABEL_PROP]: subject.label ?? '',
    [SUBJECT_DETAIL_PROP]: subject.secondary_label ?? '',
  }));
}

export function mergeSubjectPickerValues(
  values: SubjectPickerValue[],
  options: SubjectPickerValue[] = [],
): SubjectPickerValue[] {
  const optionsByValue = new Map(options.map(option => [option.value, option]));
  return values.map(value => {
    const option = optionsByValue.get(value.value);
    return {
      ...option,
      ...value,
      label: value.label ?? option?.label,
      type: value.type ?? option?.type,
      secondary_label: value.secondary_label ?? option?.secondary_label,
      [SUBJECT_TEXT_LABEL_PROP]:
        value[SUBJECT_TEXT_LABEL_PROP] ?? option?.[SUBJECT_TEXT_LABEL_PROP],
      [SUBJECT_DETAIL_PROP]:
        value[SUBJECT_DETAIL_PROP] ?? option?.[SUBJECT_DETAIL_PROP],
    };
  });
}

export function mapPickerValuesToSubjects(
  values: SubjectPickerValue[],
): Subject[] {
  return values.map(value => {
    const secondaryLabel = getDetail(value);
    return {
      id: value.value,
      label: getTextLabel(value),
      type: value.type ?? SubjectType.User,
      ...(secondaryLabel ? { secondary_label: secondaryLabel } : {}),
    };
  });
}

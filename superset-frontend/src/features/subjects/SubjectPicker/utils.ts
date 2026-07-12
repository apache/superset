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

export type SubjectPickerSource = {
  id?: number | string;
  value?: number | string;
  label?: ReactNode;
  type?: SubjectType | number;
  secondary_label?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  text?: string;
  [SUBJECT_TEXT_LABEL_PROP]?: string;
  [SUBJECT_DETAIL_PROP]?: string;
};

const getNumericId = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : undefined;
  }
  return undefined;
};

const getSubjectType = (type: unknown): SubjectType | undefined =>
  typeof type === 'number' &&
  Object.values(SubjectType).includes(type as SubjectType)
    ? (type as SubjectType)
    : undefined;

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

const getSourceTextLabel = (subject: SubjectPickerSource) => {
  const textLabel = subject[SUBJECT_TEXT_LABEL_PROP];
  if (typeof textLabel === 'string') {
    return textLabel;
  }
  if (typeof subject.label === 'string') {
    return subject.label;
  }
  if (typeof subject.text === 'string') {
    return subject.text;
  }

  return [subject.first_name, subject.last_name]
    .filter((name): name is string => typeof name === 'string' && Boolean(name))
    .join(' ');
};

const getSourceDetail = (subject: SubjectPickerSource) => {
  const detail =
    subject[SUBJECT_DETAIL_PROP] ?? subject.secondary_label ?? subject.email;
  return typeof detail === 'string' ? detail : '';
};

export function normalizeSubjectToPickerValue(
  subject: SubjectPickerSource,
): SubjectPickerValue | undefined {
  const value = getNumericId(subject.value ?? subject.id);
  if (value === undefined) {
    return undefined;
  }

  const textLabel = getSourceTextLabel(subject);
  const detail = getSourceDetail(subject);
  const type = getSubjectType(subject.type);
  const label =
    typeof subject.label === 'string' || subject.label === undefined
      ? SubjectSelectLabel({
          label: textLabel,
          type,
          secondaryLabel: detail || undefined,
        })
      : subject.label;

  return {
    value,
    label,
    type,
    secondary_label: detail || undefined,
    [SUBJECT_TEXT_LABEL_PROP]: textLabel,
    [SUBJECT_DETAIL_PROP]: detail,
  };
}

export function normalizeSubjectsToPickerValues(
  subjects: SubjectPickerSource[] = [],
): SubjectPickerValue[] {
  return subjects.flatMap(subject => {
    const value = normalizeSubjectToPickerValue(subject);
    return value ? [value] : [];
  });
}

export function mapSubjectValuesToIds(
  values: SubjectPickerSource[] = [],
): number[] {
  return values.flatMap(value => {
    const id = getNumericId(value.value ?? value.id);
    return id === undefined ? [] : [id];
  });
}

export function mapSubjectPickerValuesToIds(
  values: SubjectPickerValue[] = [],
): number[] {
  return mapSubjectValuesToIds(values);
}

/**
 * Converts an array of Subject model objects into SubjectPickerValue[]
 * suitable for use as the `value` prop of SubjectPicker.
 */
export function mapSubjectsToPickerValues(
  subjects: Subject[],
): SubjectPickerValue[] {
  return normalizeSubjectsToPickerValues(subjects);
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

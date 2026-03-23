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
import type Subject from 'src/types/Subject';
import {
  SubjectSelectLabel,
  SUBJECT_TEXT_LABEL_PROP,
  SUBJECT_DETAIL_PROP,
} from 'src/features/subjects/SubjectSelectLabel';

export interface SubjectPickerValue {
  value: number;
  label: ReactNode;
  [key: string]: unknown;
}

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
    [SUBJECT_TEXT_LABEL_PROP]: subject.label ?? '',
    [SUBJECT_DETAIL_PROP]: subject.secondary_label ?? '',
  }));
}

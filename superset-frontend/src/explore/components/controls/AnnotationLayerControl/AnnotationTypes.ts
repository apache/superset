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
import { t } from '@apache-superset/core';

interface Annotation {
  sourceType?: string;
  timeColumn?: string;
  intervalEndColumn?: string;
  titleColumn?: string;
  descriptionColumns?: string[];
}

function extractTypes<T extends Record<string, { value: string }>>(
  metadata: T,
): Record<keyof T, string> {
  return Object.keys(metadata).reduce(
    (prev, key) => {
      const result = prev;
      result[key as keyof T] = key;
      return result;
    },
    {} as Record<keyof T, string>,
  );
}

export const ANNOTATION_TYPES_METADATA = {
  FORMULA: {
    value: 'FORMULA',
    label: t('Formula'),
  },
  EVENT: {
    value: 'EVENT',
    label: t('Event'),
    supportNativeSource: true,
  },
  INTERVAL: {
    value: 'INTERVAL',
    label: t('Interval'),
    supportNativeSource: true,
  },
  TIME_SERIES: {
    value: 'TIME_SERIES',
    label: t('Time series'),
  },
};

export const ANNOTATION_TYPES = extractTypes(ANNOTATION_TYPES_METADATA);

export const DEFAULT_ANNOTATION_TYPE = ANNOTATION_TYPES.FORMULA;

export const ANNOTATION_SOURCE_TYPES_METADATA = {
  NATIVE: {
    value: 'NATIVE',
    label: 'Superset annotation',
  },
};

export const ANNOTATION_SOURCE_TYPES = extractTypes(
  ANNOTATION_SOURCE_TYPES_METADATA,
);

export function requiresQuery(
  annotationSourceType: string | undefined,
): boolean {
  return !!annotationSourceType;
}

const NATIVE_COLUMN_NAMES = {
  timeColumn: 'start_dttm',
  intervalEndColumn: 'end_dttm',
  titleColumn: 'short_descr',
  descriptionColumns: ['long_descr'],
} as const;

export function applyNativeColumns(annotation: Annotation): Annotation {
  if (annotation.sourceType === ANNOTATION_SOURCE_TYPES.NATIVE) {
    return {
      ...annotation,
      ...NATIVE_COLUMN_NAMES,
      // Spread to convert readonly array to mutable
      descriptionColumns: [...NATIVE_COLUMN_NAMES.descriptionColumns],
    };
  }
  return annotation;
}

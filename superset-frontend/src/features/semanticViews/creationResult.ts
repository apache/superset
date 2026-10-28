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
import { t } from '@apache-superset/core/translation';

interface CreationResult {
  created: string[];
  errors: { name: string; message: string }[];
  failedCount: number;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Flatten the API's string or Marshmallow field-error mapping, never HTML. */
function validationText(value: unknown, depth = 0): string {
  if (depth > 5) return '';
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) {
    return value
      .map(item => validationText(item, depth + 1))
      .filter(Boolean)
      .join('; ');
  }
  if (isRecord(value)) {
    return Object.entries(value)
      .map(([field, detail]) => {
        const text = validationText(detail, depth + 1);
        return text ? `${field}: ${text}` : '';
      })
      .filter(Boolean)
      .join('; ');
  }
  return '';
}

export const creationErrorMessage = (): string =>
  t('An error occurred while adding semantic views');

/** Only consume the documented batch result, not arbitrary transport errors. */
export function parseCreationResult(body: unknown): CreationResult {
  const result = isRecord(body) && isRecord(body.result) ? body.result : {};
  const created = Array.isArray(result.created)
    ? result.created
        .filter(
          (item): item is { name: string; uuid: string } =>
            isRecord(item) &&
            typeof item.name === 'string' &&
            typeof item.uuid === 'string',
        )
        .map(item => item.name)
    : [];
  const errors = Array.isArray(result.errors)
    ? result.errors.map((item: unknown) => ({
        name: isRecord(item) && typeof item.name === 'string' ? item.name : '',
        message:
          (isRecord(item) && validationText(item.error)) ||
          creationErrorMessage(),
      }))
    : [];
  // Count server-reported failures, not the synthetic malformed-response error.
  const failedCount = Array.isArray(result.errors)
    ? result.errors.filter(isRecord).length
    : 0;
  if (
    (result.errors !== undefined && !Array.isArray(result.errors)) ||
    !Array.isArray(result.created) ||
    created.length !== result.created.length ||
    (created.length === 0 && errors.length === 0)
  ) {
    errors.push({ name: '', message: creationErrorMessage() });
  }
  return { created, errors, failedCount };
}

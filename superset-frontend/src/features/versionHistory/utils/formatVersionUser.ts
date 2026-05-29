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
import { ChangedBy } from '../types';

export function formatVersionUser(by: ChangedBy | null): string {
  if (!by) return t('system');
  const fullName = `${by.first_name ?? ''} ${by.last_name ?? ''}`.trim();
  return fullName || by.username || t('Unknown user');
}

// Usernames that identify the Chatbot integration as the author of a
// version. The set is intentionally narrow — adding "looks like an AI"
// fuzzy matching here would silently mislabel real users. Extend this
// list as new Chatbot service accounts are provisioned.
const AI_USERNAMES = new Set<string>(['chatbot']);

export function isAiAuthor(by: ChangedBy | null): boolean {
  if (!by) return false;
  const u = (by.username ?? '').toLowerCase();
  return AI_USERNAMES.has(u);
}

export function formatVersionDate(iso: string): string {
  if (!iso) return '';
  try {
    const lang = document.documentElement.lang || undefined;
    return new Date(iso).toLocaleString(lang);
  } catch {
    return iso;
  }
}

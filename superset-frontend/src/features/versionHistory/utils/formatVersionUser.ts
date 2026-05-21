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

// Reserved username for the assistant identity used by AI-driven edits.
// Surfaces an "AI" badge in the version list.
const AI_USERNAMES = new Set(['superset_ai', 'chatbot', 'ai']);

export function formatVersionUser(by: ChangedBy | null): string {
  if (!by) return t('system');
  if (by.first_name || by.last_name) {
    return `${by.first_name ?? ''} ${by.last_name ?? ''}`.trim();
  }
  return by.username;
}

export function isAiUser(by: ChangedBy | null): boolean {
  if (!by) return false;
  return AI_USERNAMES.has(by.username?.toLowerCase?.() ?? '');
}

export function formatVersionDate(iso: string): string {
  try {
    const lang = document.documentElement.lang || undefined;
    return new Date(iso).toLocaleString(lang);
  } catch {
    return iso;
  }
}

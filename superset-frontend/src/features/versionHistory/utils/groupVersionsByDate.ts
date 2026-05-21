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
import { Version } from '../types';

export interface VersionGroup {
  label: string;
  versions: Version[];
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function bucketLabel(
  iso: string,
  todayMs: number,
  yesterdayMs: number,
): string {
  const date = new Date(iso);
  const dayMs = startOfDay(date);
  if (dayMs === todayMs) return t('Today');
  if (dayMs === yesterdayMs) return t('Yesterday');
  try {
    const lang = document.documentElement.lang || undefined;
    return date.toLocaleDateString(lang, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return iso.slice(0, 10);
  }
}

/**
 * Groups a list of versions (assumed newest-first) into date buckets.
 * The first row is always pulled out into a "Current version" group so the
 * UI can render it with a distinct treatment.
 */
export function groupVersionsByDate(versions: Version[]): VersionGroup[] {
  if (!versions.length) return [];

  const today = startOfDay(new Date());
  const yesterday = today - 24 * 60 * 60 * 1000;
  const groups: VersionGroup[] = [
    { label: t('Current version'), versions: [versions[0]] },
  ];

  let current: VersionGroup | null = null;
  for (let i = 1; i < versions.length; i += 1) {
    const v = versions[i];
    const label = bucketLabel(v.issued_at, today, yesterday);
    if (!current || current.label !== label) {
      current = { label, versions: [] };
      groups.push(current);
    }
    current.versions.push(v);
  }
  return groups;
}

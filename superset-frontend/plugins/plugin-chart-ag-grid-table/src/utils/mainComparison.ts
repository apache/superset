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

function getMainComparisonPrefixes(): string[] {
  const translated = t('Main');
  return translated === 'Main' ? ['Main'] : [translated, 'Main'];
}

export function isMainComparisonLabel(label?: string | null): boolean {
  return Boolean(label && getMainComparisonPrefixes().includes(label));
}

export function stripMainComparisonPrefix(value: string): string {
  for (const prefix of getMainComparisonPrefixes()) {
    if (value.startsWith(`${prefix} `)) {
      return value.slice(prefix.length + 1);
    }
  }
  return value;
}

export function isMainComparisonKey(key?: string | null): boolean {
  return Boolean(key && stripMainComparisonPrefix(key) !== key);
}

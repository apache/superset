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
import { DataMask, ensureIsArray } from '@superset-ui/core';

/**
 * Restrict the groupable column options to the builder-configured allowlist.
 * An unset or empty allowlist means "no restriction" so existing Group By
 * customizations (which never stored an allowlist) keep offering every
 * groupable column, preserving backwards compatibility.
 *
 * `appliedValues` are the viewer's currently applied group-by columns. They
 * stay in the options even when a later-narrowed allowlist excludes them, so
 * an applied selection keeps rendering with its verbose label instead of a
 * bare column name. The viewer can still clear it, and once cleared it is no
 * longer offered.
 */
export const applyColumnAllowlist = <T extends { value: string }>(
  options: T[],
  allowlist?: string[] | null,
  appliedValues: string[] = [],
): T[] => {
  if (!Array.isArray(allowlist) || allowlist.length === 0) {
    return options;
  }
  const allowed = new Set([...allowlist, ...appliedValues]);
  return options.filter(option => allowed.has(option.value));
};

/**
 * The columns a Group By control may group by: the builder's allowlist when
 * set, narrowed to the dataset's groupable columns when those are known.
 * Returns null when nothing restricts the choice.
 */
export const getAllowedGroupByColumns = (
  allowlist?: string[] | null,
  groupableColumns?: string[] | null,
): Set<string> | null => {
  const hasAllowlist = Array.isArray(allowlist) && allowlist.length > 0;
  const hasGroupable =
    Array.isArray(groupableColumns) && groupableColumns.length > 0;
  if (!hasAllowlist && !hasGroupable) {
    return null;
  }
  if (!hasAllowlist) {
    return new Set(groupableColumns);
  }
  if (!hasGroupable) {
    return new Set(allowlist);
  }
  const groupable = new Set(groupableColumns);
  return new Set(
    ensureIsArray(allowlist).filter(column => groupable.has(column)),
  );
};

/**
 * Drop group-by columns that `allowed` excludes from a Group By data mask
 * (the shape the Group By control writes: `custom_form_data.groupby` plus a
 * matching `filterState`). Returns the mask unchanged when nothing is
 * excluded, so an unrestricted control is never rewritten.
 */
export const pruneGroupByDataMask = (
  mask: DataMask,
  allowed: Set<string> | null,
): DataMask => {
  if (!allowed) {
    return mask;
  }
  const selected = ensureIsArray<string>(mask.filterState?.value);
  const kept = selected.filter(column => allowed.has(column));
  if (kept.length === selected.length) {
    return mask;
  }
  return {
    ...mask,
    extraFormData: {
      ...mask.extraFormData,
      custom_form_data: {
        ...mask.extraFormData?.custom_form_data,
        groupby: kept,
      },
    },
    filterState: {
      ...mask.filterState,
      label: kept.join(', '),
      value: kept.length ? kept : null,
    },
  };
};

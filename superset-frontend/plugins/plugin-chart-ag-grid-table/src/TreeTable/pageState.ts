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
const PAGE_SIZES = [10, 20, 50, 100, 200];

/** Use the viewer's valid size, the configured size, or the default. */
export function normalizePageSize(
  ownStateSize: unknown,
  formSize: unknown,
): number {
  return (
    [ownStateSize, formSize].find(
      (size): size is number =>
        typeof size === 'number' && PAGE_SIZES.includes(size),
    ) ?? 50
  );
}

/** Keep a whole page index inside the configured parent-row cap. */
export function normalizePage(
  ownStatePage: unknown,
  pageSize: number,
  rowLimit: unknown,
): number {
  const page =
    typeof ownStatePage === 'number' &&
    Number.isInteger(ownStatePage) &&
    ownStatePage >= 0
      ? ownStatePage
      : 0;
  const cap = Number(rowLimit);
  return cap > 0 ? Math.min(page, Math.ceil(cap / pageSize) - 1) : page;
}

/** Limit the final page to the parents remaining inside the cap. */
export function pageLimit(page: number, pageSize: number, rowLimit: unknown) {
  const cap = Number(rowLimit);
  return {
    row_offset: page * pageSize,
    row_limit: cap > 0 ? Math.min(pageSize, cap - page * pageSize) : pageSize,
  };
}

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

/**
 * Sort comparator with basic rankings.
 */
export function rankedSearchCompare(a: string, b: string, search: string) {
  const aLower = a.toLowerCase() || '';
  const bLower = b.toLowerCase() || '';
  const searchLower = search.toLowerCase() || '';
  if (!search) return a.localeCompare(b);
  return (
    Number(b === search) - Number(a === search) ||
    Number(b.startsWith(search)) - Number(a.startsWith(search)) ||
    Number(bLower === searchLower) - Number(aLower === searchLower) ||
    Number(bLower.startsWith(searchLower)) -
      Number(aLower.startsWith(searchLower)) ||
    Number(b.includes(search)) - Number(a.includes(search)) ||
    Number(bLower.includes(searchLower)) - Number(a.includes(searchLower)) ||
    a.localeCompare(b)
  );
}

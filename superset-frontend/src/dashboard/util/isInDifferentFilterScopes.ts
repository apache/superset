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

// Dashboard filter structure based on the actual usage pattern
interface DashboardFilterColumn {
  scope: string[];
}

interface DashboardFilter {
  chartId: number;
  scopes: Record<string, DashboardFilterColumn>;
}

interface DashboardFilters {
  [filterId: string]: DashboardFilter;
}

interface IsInDifferentFilterScopesProps {
  dashboardFilters?: DashboardFilters;
  source?: string[];
  destination?: string[];
}

export default function isInDifferentFilterScopes({
  dashboardFilters = {},
  source = [],
  destination = [],
}: IsInDifferentFilterScopesProps): boolean {
  const sourceSet = new Set(source);
  const destinationSet = new Set(destination);

  const allScopes = ([] as string[]).concat(
    ...Object.values(dashboardFilters).map(({ scopes }) =>
      ([] as string[]).concat(
        ...Object.values(scopes).map(({ scope }) => scope),
      ),
    ),
  );
  return allScopes.some(tab => destinationSet.has(tab) !== sourceSet.has(tab));
}

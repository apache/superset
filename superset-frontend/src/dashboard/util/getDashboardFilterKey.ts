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

interface GetDashboardFilterKeyProps {
  chartId: string;
  column: string;
}

export function getDashboardFilterKey({
  chartId,
  column,
}: GetDashboardFilterKeyProps) {
  return `${chartId}_${column}`;
}

const filterKeySplitter = /^([0-9]+)_(.*)$/;

export function getChartIdAndColumnFromFilterKey(key: string) {
  const match = filterKeySplitter.exec(key);
  if (!match) throw new Error('Cannot parse invalid filter key');
  return { chartId: parseInt(match[1], 10), column: match[2] };
}

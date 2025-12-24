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
import { ChartState } from 'src/explore/types';
import { Layout } from 'src/dashboard/types';
import findTopLevelComponentIds from './findTopLevelComponentIds';
import childChartsDidLoad from './childChartsDidLoad';

interface GetLoadStatsParams {
  layout: Layout;
  chartQueries: Record<string, Partial<ChartState>>;
}

interface LoadStats {
  didLoad: boolean;
  id: string;
  minQueryStartTime: number | null;
  [key: string]: unknown;
}

export default function getLoadStatsPerTopLevelComponent({
  layout,
  chartQueries,
}: GetLoadStatsParams): Record<string, LoadStats> {
  const topLevelComponents = findTopLevelComponentIds(layout);
  const stats: Record<string, LoadStats> = {};
  topLevelComponents.forEach(topLevelComponent => {
    const { id, ...restStats } = topLevelComponent;
    const { didLoad, minQueryStartTime } = childChartsDidLoad({
      id,
      layout,
      chartQueries,
    });

    stats[id] = {
      didLoad,
      id,
      minQueryStartTime,
      ...restStats,
    };
  });

  return stats;
}

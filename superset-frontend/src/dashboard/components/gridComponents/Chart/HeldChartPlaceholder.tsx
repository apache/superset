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
import { EmptyState, Flex, Loading } from '@superset-ui/core/components';

// The size rule of the "No results" state (ChartRenderer).
const BIG_EMPTY_STATE_MIN_WIDTH = 300;
const BIG_EMPTY_STATE_MIN_HEIGHT = 220;

/** What a held chart shows instead of the chart. */
export default function HeldChartPlaceholder({
  view,
  width,
  height,
}: {
  view: 'loading' | 'waiting' | null;
  width: number;
  height: number;
}) {
  return (
    <Flex vertical justify="center" data-test="chart-held" style={{ height }}>
      {view === 'waiting' ? (
        <EmptyState
          size={
            width > BIG_EMPTY_STATE_MIN_WIDTH &&
            height > BIG_EMPTY_STATE_MIN_HEIGHT
              ? 'large'
              : 'small'
          }
          title={t('Waiting for a valid time range')}
          description={null}
          image="chart.svg"
        />
      ) : (
        <Loading size="s" muted position="inline-centered" />
      )}
    </Flex>
  );
}

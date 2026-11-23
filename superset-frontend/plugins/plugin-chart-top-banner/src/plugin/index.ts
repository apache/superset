/*
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
import {
  Behavior,
  ChartMetadata,
  ChartPlugin,
  ChartProps,
} from '@superset-ui/core';

import TopBanner from '../TopBanner';
import transformProps from '../transformProps';
import { TopBannerFormData } from '../types';
import buildQuery from './buildQuery';
import controlPanel from './controlPanel';

const thumbnail =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(`
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="400"
      height="260"
      viewBox="0 0 400 260"
    >
      <rect
        width="400"
        height="260"
        rx="28"
        fill="#f8fafc"
      />
      <rect
        x="28"
        y="70"
        width="344"
        height="120"
        rx="18"
        fill="#ffffff"
        stroke="#20a7c9"
        stroke-width="5"
      />
      <rect
        x="50"
        y="94"
        width="64"
        height="64"
        rx="12"
        fill="#20a7c9"
      />
      <text
        x="82"
        y="136"
        text-anchor="middle"
        font-size="30"
      >
        😶‍🌫️
      </text>
      <rect
        x="132"
        y="101"
        width="112"
        height="15"
        rx="7"
        fill="#183153"
      />
      <rect
        x="132"
        y="128"
        width="87"
        height="10"
        rx="5"
        fill="#94a3b8"
      />
      <rect
        x="278"
        y="105"
        width="66"
        height="13"
        rx="6"
        fill="#183153"
      />
      <rect
        x="294"
        y="132"
        width="50"
        height="9"
        rx="4"
        fill="#94a3b8"
      />
    </svg>
  `);

export default class TopBannerChartPlugin extends ChartPlugin<
  TopBannerFormData,
  ChartProps<TopBannerFormData>
> {
  constructor() {
    const metadata = new ChartMetadata({
      behaviors: [Behavior.InteractiveChart],
      category: t('Other'),
      description: t(
        'Configurable dashboard banner with title, subtitle, icon, and a live clock',
      ),
      name: t('Top Banner'),
      thumbnail,
    });

    super({
      buildQuery,
      controlPanel,
      loadChart: () => TopBanner,
      metadata,
      transformProps,
    });
  }
}
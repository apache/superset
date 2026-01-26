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
import { ReactElement } from 'react';
import { VizType, css } from '@superset-ui/core';
import { Icons } from '@superset-ui/core/components/Icons';
import { VizMeta } from './types';

// Custom icons for non-featured charts
export const CUSTOM_CHART_ICONS: Record<string, ReactElement> = {
  deck_multi: <Icons.Multiple iconSize="l" viewBox="5 4 15 20" />,
};

export const FEATURED_CHARTS: VizMeta[] = [
  {
    name: VizType.Line,
    icon: <Icons.LineChartOutlined iconSize="l" />,
  },
  {
    name: VizType.Bar,
    icon: <Icons.BarChartOutlined iconSize="l" />,
  },
  { name: VizType.Area, icon: <Icons.AreaChartOutlined iconSize="l" /> },
  { name: VizType.Table, icon: <Icons.TableOutlined iconSize="l" /> },
  {
    name: VizType.BigNumberTotal,
    icon: (
      <Icons.BigNumberChartTile
        iconSize="l"
        viewBox="0 0 16 14"
        css={css`
          path {
            fill: currentColor;
          }
        `}
      />
    ),
  },
  { name: VizType.Pie, icon: <Icons.PieChartOutlined iconSize="l" /> },
];

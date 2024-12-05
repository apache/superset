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
import Icons from 'src/components/Icons';
import { VizMeta } from './types';

export const FEATURED_CHARTS: VizMeta[] = [
  {
    name: 'echarts_timeseries_line',
    icon: <Icons.LineChartTile />,
  },
  {
    name: 'echarts_timeseries_bar',
    icon: <Icons.BarChartTile />,
  },
  { name: 'echarts_area', icon: <Icons.AreaChartTile /> },
  { name: 'table', icon: <Icons.TableChartTile /> },
  {
    name: 'big_number_total',
    icon: <Icons.BigNumberChartTile />,
  },
  { name: 'pie', icon: <Icons.PieChartTile /> },
];

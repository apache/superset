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
import { SupersetTheme } from '@superset-ui/core';
import { GaugeSeriesOption } from 'echarts';

export const defaultGaugeSeriesOption = (
  theme: SupersetTheme,
): GaugeSeriesOption => ({
  splitLine: {
    lineStyle: {
      color: theme.colors.primary.base,
    },
  },
  axisLine: {
    lineStyle: {
      color: [[1, theme.colors.primary.light4]],
    },
  },
  axisLabel: {
    color: theme.colors.grayscale.dark1,
  },
  axisTick: {
    lineStyle: {
      width: 2,
      color: theme.colors.primary.base,
    },
  },
  detail: {
    color: 'auto',
  },
});

export const INTERVAL_GAUGE_SERIES_OPTION: GaugeSeriesOption = {
  splitLine: {
    lineStyle: {
      color: 'auto',
    },
  },
  axisTick: {
    lineStyle: {
      color: 'auto',
    },
  },
  axisLabel: {
    color: 'auto',
  },
  pointer: {
    itemStyle: {
      color: 'auto',
    },
  },
};

export const OFFSETS = {
  ticksFromLine: 10,
  titleFromCenter: 20,
};

export const FONT_SIZE_MULTIPLIERS = {
  axisTickLength: 0.25,
  axisLabelDistance: 1.5,
  axisLabelLength: 0.35,
  splitLineLength: 1,
  splitLineWidth: 0.25,
  titleOffsetFromTitle: 2,
  detailOffsetFromTitle: 0.9,
  detailFontSize: 1.2,
};

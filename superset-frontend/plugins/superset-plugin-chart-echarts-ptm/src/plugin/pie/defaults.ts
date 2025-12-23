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
import {
  PTM_TYPOGRAPHY,
  PTM_TEXT_COLOR_LIGHT,
  PTM_BORDER_RADIUS,
  PTM_ECHART_BASE,
  PTM_ECHART_TOOLTIP,
  PTM_ECHART_LEGEND,
} from '../../shared/ptmTheme';

export const PIE_PTM_DEFAULTS = {
  ...PTM_ECHART_BASE,
  textStyle: {
    fontFamily: PTM_TYPOGRAPHY.fontFamily.body,
    color: PTM_TEXT_COLOR_LIGHT,
  },
  legend: PTM_ECHART_LEGEND,
  tooltip: {
    ...PTM_ECHART_TOOLTIP,
    trigger: 'item' as const,
  },
  series: [
    {
      radius: ['45%', '70%'],
      padAngle: 2,
      itemStyle: {
        borderRadius: PTM_BORDER_RADIUS.button,
      },
      label: {
        fontFamily: PTM_TYPOGRAPHY.fontFamily.body,
        fontSize: PTM_TYPOGRAPHY.fontSize.small,
        color: PTM_TEXT_COLOR_LIGHT,
      },
      emphasis: {
        itemStyle: {
          shadowBlur: 20,
          shadowColor: 'rgba(0, 0, 0, 0.15)',
        },
        label: {
          fontWeight: PTM_TYPOGRAPHY.fontWeight.semibold,
        },
      },
    },
  ],
};

export default PIE_PTM_DEFAULTS;


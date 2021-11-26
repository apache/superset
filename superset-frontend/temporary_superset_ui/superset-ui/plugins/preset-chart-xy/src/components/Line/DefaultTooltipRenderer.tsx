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

import React from 'react';
import { TooltipFrame, TooltipTable } from '@superset-ui/core';
import { chartTheme } from '@data-ui/theme';
import { TooltipProps } from './Line';

const MARK_STYLE = { marginRight: 4 };

export default function DefaultTooltipRenderer({
  allSeries,
  datum,
  encoder,
  series = {},
  theme = chartTheme,
}: TooltipProps) {
  return (
    <TooltipFrame>
      <>
        <div style={{ fontFamily: theme.labelStyles.fontFamily }}>
          <strong>{encoder.channels.x.formatValue(datum.x)}</strong>
        </div>
        <br />
        {series && (
          <TooltipTable
            data={allSeries
              .filter(({ key }) => series[key])
              .concat()
              .sort((a, b) => series[b.key].y - series[a.key].y)
              .map(({ key, stroke, strokeDasharray, strokeWidth }) => ({
                key,
                keyColumn: (
                  <>
                    <svg width="12" height="8" style={MARK_STYLE}>
                      <line
                        x2="12"
                        y1="3"
                        y2="3"
                        stroke={stroke}
                        strokeWidth={strokeWidth}
                        strokeDasharray={strokeDasharray}
                      />
                    </svg>
                    {series[key] === datum ? <b>{key}</b> : key}
                  </>
                ),
                valueColumn: encoder.channels.y.formatValue(series[key].y),
              }))}
          />
        )}
      </>
    </TooltipFrame>
  );
}

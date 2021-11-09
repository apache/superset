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
import { isCompleteFieldDef } from 'encodable';
import { uniqBy } from 'lodash';
import { Tooltip } from '@vx/tooltip';
import { TooltipFrame, TooltipTable } from '@superset-ui/core';
import { ChoroplethMapChannelOutputs, ChoroplethMapEncoder } from './Encoder';

export type MapDataPoint = Omit<ChoroplethMapChannelOutputs, 'tooltip'> & {
  datum: Record<string, unknown>;
};

export type MapTooltipProps = {
  top?: number;
  left?: number;
  encoder: ChoroplethMapEncoder;
  tooltipData?: MapDataPoint;
};

export default function MapTooltip({
  encoder,
  left,
  top,
  tooltipData,
}: MapTooltipProps) {
  if (!tooltipData) {
    return null;
  }

  const { channels } = encoder;
  const { key, fill, stroke, strokeWidth, opacity, tooltip } = channels;
  const { datum } = tooltipData;

  const tooltipRows = [
    {
      key: 'key',
      keyColumn: key.getTitle(),
      valueColumn: key.formatDatum(datum),
    },
  ];

  [fill, stroke, opacity, strokeWidth].forEach(channel => {
    if (isCompleteFieldDef<string | number>(channel.definition)) {
      tooltipRows.push({
        key: channel.name as string,
        keyColumn: channel.getTitle(),
        valueColumn: channel.formatDatum(datum),
      });
    }
  });

  tooltip.forEach(g => {
    tooltipRows.push({
      key: `${g.name}`,
      keyColumn: g.getTitle(),
      valueColumn: g.formatDatum(datum),
    });
  });

  return (
    <Tooltip top={top} left={left}>
      <TooltipFrame>
        <TooltipTable data={uniqBy(tooltipRows, row => row.keyColumn)} />
      </TooltipFrame>
    </Tooltip>
  );
}

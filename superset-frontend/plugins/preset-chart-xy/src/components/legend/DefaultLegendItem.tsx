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

import React, { CSSProperties } from 'react';
import { LegendItem, LegendLabel } from '@vx/legend';
import { EncodingConfig } from 'encodable';
import { LegendItemRendererProps } from './types';

const MARK_SIZE = 8;

const MARK_STYLE: CSSProperties = { display: 'inline-block' };

export default function DefaultLegendItem<Config extends EncodingConfig>({
  group,
  item,
  MarkRenderer,
  LabelRenderer,
}: LegendItemRendererProps<Config>) {
  return (
    <LegendItem key={`legend-item-${group.field}-${item.input}`} margin="0 5px">
      {typeof MarkRenderer === 'undefined' ? (
        <svg width={MARK_SIZE} height={MARK_SIZE} style={MARK_STYLE}>
          <circle
            fill={
              // @ts-ignore
              (item.output.color ??
                // @ts-ignore
                item.output.fill ??
                // @ts-ignore
                item.output.stroke ??
                '#ccc') as string
            }
            stroke={
              // @ts-ignore
              (item.output.stroke ?? 'none') as string
            }
            r={MARK_SIZE / 2}
            cx={MARK_SIZE / 2}
            cy={MARK_SIZE / 2}
          />
        </svg>
      ) : (
        <MarkRenderer group={group} item={item} />
      )}
      {typeof LabelRenderer === 'undefined' ? (
        <LegendLabel align="left" margin="0 0 0 4px">
          {item.input}
        </LegendLabel>
      ) : (
        <LabelRenderer group={group} item={item} />
      )}
    </LegendItem>
  );
}

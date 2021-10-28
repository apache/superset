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
import { LegendItemMarkRendererProps } from '../legend/types';
import { LineEncodingConfig } from './Encoder';

const MARK_WIDTH = 12;
const MARK_HEIGHT = 8;

const MARK_STYLE: CSSProperties = { display: 'inline-block' };

export default function DefaultLegendItemMarkRenderer({
  item,
}: LegendItemMarkRendererProps<LineEncodingConfig>) {
  return (
    <svg width={MARK_WIDTH} height={MARK_HEIGHT} style={MARK_STYLE}>
      <line
        stroke={item.output.stroke ?? 'none'}
        strokeWidth={item.output.strokeWidth ?? 2}
        strokeDasharray={item.output.strokeDasharray ?? 'none'}
        x1={0}
        x2={MARK_WIDTH}
        y1={MARK_HEIGHT / 2}
        y2={MARK_HEIGHT / 2}
      />
    </svg>
  );
}

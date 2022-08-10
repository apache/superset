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
import { EncodingConfig } from 'encodable';
import { LegendGroupRendererProps } from './types';
import DefaultLegendItem from './DefaultLegendItem';

const LEGEND_GROUP_STYLE: CSSProperties = {
  display: 'flex',
  flexBasis: 'auto',
  flexDirection: 'row',
  flexGrow: 1,
  flexShrink: 1,
  flexWrap: 'wrap',
  fontSize: '0.8em',
  justifyContent: 'flex-end',
  padding: 8,
};

export default function DefaultLegendGroupRenderer<
  Config extends EncodingConfig,
>({
  group,
  ItemRenderer = DefaultLegendItem,
  ItemMarkRenderer,
  ItemLabelRenderer,
  style,
}: LegendGroupRendererProps<Config>) {
  const combinedStyle =
    typeof style === 'undefined'
      ? LEGEND_GROUP_STYLE
      : { ...LEGEND_GROUP_STYLE, ...style };

  return (
    <div style={combinedStyle}>
      {'items' in group &&
        group.items.map(item => (
          <ItemRenderer
            key={`legend-item-${group.field}-${item.input}`}
            group={group}
            item={item}
            MarkRenderer={ItemMarkRenderer}
            LabelRenderer={ItemLabelRenderer}
          />
        ))}
    </div>
  );
}

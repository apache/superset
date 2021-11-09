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

import React, { CSSProperties, PureComponent } from 'react';
import { EncodingConfig } from 'encodable';
import { LegendRendererProps } from './types';
import DefaultLegendGroup from './DefaultLegendGroup';

const LEGEND_CONTAINER_STYLE: CSSProperties = {
  display: 'flex',
  flexBasis: 'auto',
  flexGrow: 1,
  flexShrink: 1,
  maxHeight: 100,
  overflowY: 'auto',
  position: 'relative',
};

export type Props<Config extends EncodingConfig> = LegendRendererProps<Config>;

export default class DefaultLegend<
  Config extends EncodingConfig,
> extends PureComponent<Props<Config>> {
  render() {
    const {
      groups,
      LegendGroupRenderer = DefaultLegendGroup,
      LegendItemRenderer,
      LegendItemMarkRenderer,
      LegendItemLabelRenderer,
      style,
    } = this.props;

    const combinedStyle =
      typeof style === 'undefined'
        ? LEGEND_CONTAINER_STYLE
        : { ...LEGEND_CONTAINER_STYLE, ...style };

    return (
      <div style={combinedStyle}>
        {groups
          .filter(group => 'items' in group && group.items.length > 0)
          .map(group => (
            <LegendGroupRenderer
              key={group.field}
              group={group}
              ItemRenderer={LegendItemRenderer}
              ItemMarkRenderer={LegendItemMarkRenderer}
              ItemLabelRenderer={LegendItemLabelRenderer}
            />
          ))}
      </div>
    );
  }
}

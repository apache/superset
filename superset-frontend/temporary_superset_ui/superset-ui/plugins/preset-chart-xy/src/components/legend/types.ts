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

import { CSSProperties } from 'react';
import {
  EncodingConfig,
  LegendGroupInformation,
  LegendItemInformation,
} from 'encodable';

export type LegendItemMarkRendererProps<Config extends EncodingConfig> = {
  group: LegendGroupInformation<Config>;
  item: LegendItemInformation<Config>;
};

export type LegendItemMarkRendererType<Config extends EncodingConfig> =
  React.ComponentType<LegendItemMarkRendererProps<Config>>;

export type LegendItemLabelRendererProps<Config extends EncodingConfig> =
  LegendItemMarkRendererProps<Config>;

export type LegendItemLabelRendererType<Config extends EncodingConfig> =
  React.ComponentType<LegendItemLabelRendererProps<Config>>;

export type LegendItemRendererProps<Config extends EncodingConfig> = {
  group: LegendGroupInformation<Config>;
  item: LegendItemInformation<Config>;
  MarkRenderer?: LegendItemMarkRendererType<Config>;
  LabelRenderer?: LegendItemLabelRendererType<Config>;
};

export type LegendItemRendererType<Config extends EncodingConfig> =
  React.ComponentType<LegendItemRendererProps<Config>>;

export type LegendGroupRendererProps<Config extends EncodingConfig> = {
  group: LegendGroupInformation<Config>;
  ItemRenderer?: LegendItemRendererType<Config>;
  ItemMarkRenderer?: LegendItemMarkRendererType<Config>;
  ItemLabelRenderer?: LegendItemLabelRendererType<Config>;
  style?: CSSProperties;
};

export type LegendGroupRendererType<Config extends EncodingConfig> =
  React.ComponentType<LegendGroupRendererProps<Config>>;

export type LegendRendererProps<Config extends EncodingConfig> = {
  groups: LegendGroupInformation<Config>[];
  LegendGroupRenderer?: LegendGroupRendererType<Config>;
  LegendItemRenderer?: LegendItemRendererType<Config>;
  LegendItemMarkRenderer?: LegendItemMarkRendererType<Config>;
  LegendItemLabelRenderer?: LegendItemLabelRendererType<Config>;
  style?: CSSProperties;
};

export type LegendRendererType<Config extends EncodingConfig> =
  React.ComponentType<LegendRendererProps<Config>>;

export type LegendHooks<Config extends EncodingConfig> = {
  LegendRenderer?: LegendRendererType<Config>;
  LegendGroupRenderer?: LegendGroupRendererType<Config>;
  LegendItemRenderer?: LegendItemRendererType<Config>;
  LegendItemMarkRenderer?: LegendItemMarkRendererType<Config>;
  LegendItemLabelRenderer?: LegendItemLabelRendererType<Config>;
};

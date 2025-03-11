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

import { DataNode, TreeProps } from 'antd/lib/tree';
import { ControlComponentProps } from '@superset-ui/chart-controls';
import { Style } from 'geostyler-style';
import { CardStyleProps } from 'geostyler/dist/Component/CardStyle/CardStyle';

export interface BaseLayerConf {
  title: string;
  url: string;
  type: string;
  attribution?: string;
}

export interface WfsLayerConf extends BaseLayerConf {
  type: 'WFS';
  typeName: string;
  version: string;
  maxFeatures?: number;
  style?: Style;
}

export interface XyzLayerConf extends BaseLayerConf {
  type: 'XYZ';
}

export interface WmsLayerConf extends BaseLayerConf {
  type: 'WMS';
  version: string;
  layersParam: string;
}

export interface FlatLayerDataNode extends DataNode {
  layerConf: LayerConf;
}

export interface FlatLayerTreeProps {
  layerConfigs: LayerConf[];
  onAddLayer?: () => void;
  onRemoveLayer?: (idx: number) => void;
  onEditLayer?: (layerConf: LayerConf, idx: number) => void;
  onMoveLayer?: (layerConfigs: LayerConf[]) => void;
  draggable?: boolean;
  className?: string;
}

export type LayerConf = WmsLayerConf | WfsLayerConf | XyzLayerConf;

export type DropInfoType<T extends TreeProps['onDrop']> = T extends Function
  ? Parameters<T>[0]
  : undefined;

export interface EditItem {
  layerConf: LayerConf;
  idx: number;
}

export type LayerConfigsControlProps = ControlComponentProps<LayerConf[]>;

export interface LayerConfigsPopoverContentProps {
  onClose?: () => void;
  onSave?: (layerConf: LayerConf) => void;
  layerConf: LayerConf;
}

export interface GeoStylerWrapperProps extends CardStyleProps {
  className?: string;
}

export interface LayerTreeItemProps {
  layerConf: LayerConf;
  onEditClick?: () => void;
  onRemoveClick?: () => void;
  className?: string;
}

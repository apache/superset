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
import { FeatureCollection, GeoJsonGeometryTypes } from 'geojson';
import { QueryFormData } from '@superset-ui/core';

export interface BaseLayerConf {
  title: string;
  type: string;
  attribution?: string;
}

export interface WfsLayerConf extends BaseLayerConf {
  type: 'WFS';
  url: string;
  typeName: string;
  version: string;
  maxFeatures?: number;
  style?: Style;
}

export interface XyzLayerConf extends BaseLayerConf {
  type: 'XYZ';
  url: string;
}

export interface WmsLayerConf extends BaseLayerConf {
  type: 'WMS';
  url: string;
  version: string;
  layersParam: string;
}

export interface DataLayerConf extends BaseLayerConf {
  type: 'DATA';
  style?: Style;
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

export type LayerConf =
  | WmsLayerConf
  | WfsLayerConf
  | XyzLayerConf
  | DataLayerConf;

export type DropInfoType<T extends TreeProps['onDrop']> = T extends Function
  ? Parameters<T>[0]
  : undefined;

export interface EditItem {
  layerConf: LayerConf;
  idx: number;
}

export type ColTypeMapping = {
  /** Mapping between a column and its type */
  [column_name: string]: string;
};

export type LayerConfigsControlProps = ControlComponentProps<LayerConf[]> & {
  /** Set to true, if chart data should be included as layer. */
  enableDataLayer?: boolean;
  /** Mapping object providing the types for each column. Only needed if enableDataLayer is true.  */
  colTypeMapping?: ColTypeMapping;
  /** List of formData attributes to watch for changes. If a change was detected, the
   *  chart data will be fetched again. Only needed if enableDataLayer is true.
   */
  formWatchers?: string[];
  /** Transformer function that transforms the chart data into a feature collection.
   *  Only needed if enableDataLayer is true.
   */
  featureCollectionTransformer?: (
    data: any,
    formData: QueryFormData,
  ) => FeatureCollection;
};

export interface LayerConfigsPopoverContentProps {
  onClose?: () => void;
  onSave?: (layerConf: LayerConf) => void;
  layerConf: LayerConf;
  enableDataLayer: boolean;
  colTypeMapping?: ColTypeMapping;
  dataFeatureCollection?: FeatureCollection;
  includedGeometryTypes?: GeoJsonGeometryTypes[];
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

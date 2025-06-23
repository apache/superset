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
  DataRecord,
  SupersetTheme,
  TimeseriesDataRecord,
} from '@superset-ui/core';
import { Map } from 'ol';
import { FeatureCollection, GeoJsonProperties, Geometry } from 'geojson';
import { SliderSingleProps } from 'antd/lib/slider';
import VectorSource from 'ol/source/Vector';
import VectorLayer from 'ol/layer/Vector';
import { LayerConf, MapMaxExtentConfigs, MapViewConfigs } from '../types';
import { GeometryFormat, TimesliderTooltipFormat } from '../constants';

export type DataFeatureCollection = FeatureCollection<
  Geometry,
  GeoJsonProperties
>;

export interface ThematicMapPluginStylesProps {
  height: number;
  width: number;
  theme: SupersetTheme;
}

interface ThematicMapPluginCustomizeProps {
  geomColumn: string;
  geomFormat: GeometryFormat;
  columns: string[];
  layerConfigs: LayerConf[];
  mapView: MapViewConfigs;
  maxZoom: number;
  minZoom: number;
  mapExtentPadding?: number | undefined;
  timesliderTooltipFormat: TimesliderTooltipFormat;
  mapMaxExtent: MapMaxExtentConfigs;
  setControlValue: Function;
  showTimeslider: boolean;
  timeColumn: string;
  tooltipTemplate: string;
  showLegend: boolean;
  showTooltip: boolean;
}

export type ThematicMapPluginProps = ThematicMapPluginStylesProps &
  ThematicMapPluginCustomizeProps & {
    data: TimeseriesDataRecord[];
  };

export type ThematicMapPluginConstructorOpts = {
  defaultLayers?: LayerConf[];
};

export interface OlChartMapProps extends ThematicMapPluginProps {
  mapId: string;
  olMap: Map;
  timeFilter: number | undefined;
}

export type ColTypeMapping = {
  [key: string]: string;
};

export interface TimeSliderProps extends SliderSingleProps {
  data: DataRecord[];
  timeColumn: string;
  timesliderTooltipFormat: TimesliderTooltipFormat;
}

export type FeatureTooltipProps = {
  className?: string;
  olMap: Map;
  dataLayers?: VectorLayer<VectorSource>[];
  tooltipTemplate: string;
  showTooltip: boolean;
};

export type LegendProps = {
  className?: string;
  olMap: Map;
  layerConfigs: LayerConf[];
};

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
import { RenderFunction } from 'ol/layer/Layer';
import { Extent } from 'ol/extent';
import Source from 'ol/source/Source';
import { Coordinate } from 'ol/coordinate';
import { Map } from 'ol';
import { Feature, FeatureCollection, Point } from 'geojson';
import { Style } from 'geostyler-style';

export interface CartodiagramPluginStylesProps {
  height: number;
  width: number;
  theme: SupersetTheme;
}

// TODO find a way to reference props from other charts
export type ChartConfigProperties = any;

export type ChartConfigFeature = Feature<Point, ChartConfigProperties>;
export type ChartConfig = FeatureCollection<
  ChartConfigFeature['geometry'],
  ChartConfigFeature['properties']
>;

interface CartodiagramPluginCustomizeProps {
  geomColumn: string;
  selectedChart: string;
  chartConfigs: ChartConfig;
  chartSize: ZoomConfigs;
  chartVizType: string;
  layerConfigs: LayerConf[];
  mapView: MapViewConfigs;
  chartBackgroundColor: {
    r: number;
    g: number;
    b: number;
    a: number;
  };
  chartBackgroundBorderRadius: number;
  setControlValue: Function;
}

export type CartodiagramPluginProps = CartodiagramPluginStylesProps &
  CartodiagramPluginCustomizeProps & {
    data: TimeseriesDataRecord[];
  };

export interface OlChartMapProps extends CartodiagramPluginProps {
  mapId: string;
  olMap: Map;
}

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

export type LayerConf = WmsLayerConf | WfsLayerConf | XyzLayerConf;

export type EventHandlers = Record<string, { (props: any): void }>;

export type SelectedChartConfig = {
  viz_type: string;
  params: {
    [key: string]: any;
  };
};

export type LocationConfigMapping = {
  [key: string]: DataRecord[];
};

export type MapViewConfigs = {
  mode: 'FIT_DATA' | 'CUSTOM';
  zoom: number;
  latitude: number;
  longitude: number;
  fixedZoom: number;
  fixedLatitude: number;
  fixedLongitude: number;
};

export type ZoomConfigs = ZoomConfigsFixed | ZoomConfigsLinear | ZoomConfigsExp;

export type ChartSizeValues = {
  [index: number]: { width: number; height: number };
};

export interface ZoomConfigsBase {
  type: string;
  configs: {
    zoom: number;
    width: number;
    height: number;
    slope?: number;
    exponent?: number;
  };
  values: ChartSizeValues;
}

export interface ZoomConfigsFixed extends ZoomConfigsBase {
  type: 'FIXED';
}

export interface ZoomConfigsLinear extends ZoomConfigsBase {
  type: 'LINEAR';
  configs: {
    zoom: number;
    width: number;
    height: number;
    slope: number;
    exponent?: number;
  };
}

export interface ZoomConfigsExp extends ZoomConfigsBase {
  type: 'EXP';
  configs: {
    zoom: number;
    width: number;
    height: number;
    slope?: number;
    exponent: number;
  };
}

export type ChartHtmlElement = {
  htmlElement: HTMLDivElement;
  coordinate: Coordinate;
  width: number;
  height: number;
};

export type ChartLayerOptions = {
  chartSizeValues?: ChartSizeValues;
  chartConfigs?: ChartConfig;
  chartVizType: string;
  onMouseOver?: (this: GlobalEventHandlers, ev: MouseEvent) => any | undefined;
  onMouseOut?: (this: GlobalEventHandlers, ev: MouseEvent) => any | undefined;
  [key: string]: any; // allow custom types like 'name'
  // these properties are copied from OpenLayers
  // TODO: consider extending the OpenLayers options type
  className?: string | undefined;
  opacity?: number | undefined;
  visible?: boolean | undefined;
  extent?: Extent | undefined;
  zIndex?: number | undefined;
  minResolution?: number | undefined;
  maxResolution?: number | undefined;
  minZoom?: number | undefined;
  maxZoom?: number | undefined;
  source?: Source | undefined;
  map?: Map | null | undefined;
  render?: RenderFunction | undefined;
  properties?: { [x: string]: any } | undefined;
};

export type CartodiagramPluginConstructorOpts = {
  defaultLayers?: LayerConf[];
};

export type ChartWrapperProps = {
  vizType: string;
  theme: SupersetTheme;
  width: number;
  height: number;
  chartConfig: ChartConfigFeature;
};

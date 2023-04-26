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
import { QueryFormData } from '@superset-ui/core';

export interface RGBA {
  r: number,
  g: number,
  b: number,
  a: number
}

export interface Feature {
  type: "Feature",
  bbox?: number[],
  geometry: Geometry,
  id?: string | number,
  properties?: Record<string, any>,
}

export interface Geometry {
  type: "Point" | "MultiPoint" | "LineString" | "MultiLineString" | "Polygon" | "MultiPolygon" | "GeometryCollection",
  coordinates: number[] | number[][] | number[][][],
  bbox?: number[],
}

export interface GeoJSON {
  type: "FeatureCollection" | "Feature" | "Point" | "MultiPoint" | "LineString" | "MultiLineString" | "Polygon" | "MultiPolygon" | "GeometryCollection",
  bbox?: number[],
  features?: Feature[],
  geometry?: Geometry,
  properties?: Record<string, any>,
}

export interface LiqThematicMapsStylesProps {
  height: number;
  width: number;
}

export interface LiqMap<A extends string | number | symbol, B> {
  [key: string | number]: Record<A, B>;
}

export interface TASectorColour {
  colour: string;
  sector: string;
}

export interface TASectorCentroid {
  centre: string;
  coordinates: [number, number];
}

export interface IntranetSchema {
  Layer: string;
  [key: string] : any;
}

export interface ThematicSchema {
  Centre: string;
  Sector: string;
  Colour: string;
  lng: number;
  lat: number
}

interface LiqThematicMapsCustomizeProps {
  boundary?: string;
  breaksMode?: string;
  customColor?: RGBA;
  customColorAttribute?: string;
  customColorAttributeCheck?: boolean;
  customColorBreaksMode?: string;
  customColorMode?: string;
  customColorNumClasses?: string;
  customColorOpacity?: number;
  customColorScheme?: string;
  customDatabase?: string;
  customGeom?: string;
  customMode?: string;
  customName?: string;
  customSchema?: string;
  customShape?: string;
  customSize?: number;
  customSizeAttribute?: string;
  customSizeBreaksMode?: string;
  customSizeMode?: string;
  customSizeMultiplier?: number;
  customSizeNumClasses?: number;
  customTable?: string;
  customtileset?: string;
  customType?: string;
  drivetimeBorderColor?: RGBA;
  drivetimeLinkedCharts?: string;
  features?: string[];
  intersectSa1Color?: RGBA;
  intersectSa1Width?: number;
  intranetLayers?: string[];
  latitude?: number;
  longitude?: number;
  mapStyle?: string;
  mapType?: string[];
  numClasses?: number;
  opacity: number;
  radiusBorderColor?: RGBA;
  radiusBorderWidth?: number;
  radiusLinkedCharts?: string;
  radiusThreshold?: number;
  zoom?: number;
}

export type LiqThematicMapsQueryFormData = QueryFormData &
  LiqThematicMapsStylesProps &
  LiqThematicMapsCustomizeProps;

export type LiqThematicMapsProps = LiqThematicMapsStylesProps &
  LiqThematicMapsCustomizeProps & {
    data: Array<Object>[];
    groupCol: string;
    metricCol: string;
    // add typing here for the props you pass in from transformProps.ts!
    tradeAreas?: string[];
    tradeAreaSA1s?: Object;
    taSectorSA1Map?: Object;
    taSectorColorMap?: Object;
    sectorCentroids?: Object;
    intranetData?: Object;
    taSectorCentroids?: GeoJSON;
    newRadiusColor?: string;
    newDrivetimeColor?: string;
    newCustomColor?: string;
    newRadiusBorderColor?: string;
    newDrivetimeBorderColor?: string;
    newIntersectSa1Color?: string;
    newRadiusLinkedCharts?: number[];
    newDrivetimeLinkedCharts?: number[];
  };

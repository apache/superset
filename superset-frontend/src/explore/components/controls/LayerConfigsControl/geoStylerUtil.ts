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
import { FeatureCollection, GeoJsonGeometryTypes } from 'geojson';
import { VectorData } from 'geostyler-data';
import { GeoStylerContextInterface, GeoStylerLocale, locale } from 'geostyler';

import { Style, Symbolizer } from 'geostyler-style';
import { ColTypeMapping } from './types';
import { SupersetTheme } from '@apache-superset/core/theme';

/**
 * Map Superset column type to GeoStyler column type.
 * @param colType The Superset columntype
 * @returns The GeoStyler column type.
 */
export const colTypeToGeoStylerType = (colType: string) => {
  // TODO add missing types
  switch (colType) {
    case 'LONGINTEGER':
    case 'INTEGER':
      return 'integer';
    case 'STRING':
      return 'string';
    case 'DATETIME':
    case 'DATE':
    case 'FLOAT':
    case 'DECIMAL':
      return 'number';
    default:
      return colType;
  }
};

/**
 * Map Superset column types to GeoStyler data.
 * @param colTypes The superset column types.
 * @returns A geotyler-data object.
 */
export const colTypesToGeoStylerData = (
  colTypes: ColTypeMapping,
  dataFeatureCollection: FeatureCollection = {
    type: 'FeatureCollection',
    features: [],
  },
) => {
  const data: VectorData = {
    schema: {
      type: 'object',
      properties: Object.keys(colTypes).reduce(
        (prev, cur) => ({
          ...prev,
          [cur]: {
            type: colTypeToGeoStylerType(colTypes[cur]),
          },
        }),
        {},
      ),
    },
    exampleFeatures: dataFeatureCollection,
  };
  return data;
};

/**
 * Create a GeoStylerContext.
 *
 * Sets the locales, GsData, and enables and disables certain features
 * depending on given data and their geometries.
 *
 * @param gsLocale The locales of the active language.
 * @param data The GeoStyler Data.
 * @param geomTypes List of distinct geometry types.
 * @returns The GeoStylerContext.
 */
export const createGeoStylerContext = (
  gsLocale: GeoStylerLocale,
  data: VectorData | undefined,
  composition: GeoStylerContextInterface['composition'],
) => {
  const context: GeoStylerContextInterface = {
    locale: gsLocale,
    composition: composition ?? {},
  };

  if (data) {
    context.data = data;
  }

  if (!context.composition!.Rules) {
    context.composition!.Rules = {};
  }
  context.composition!.Rules.disableClassification =
    !data?.exampleFeatures.features.length;

  return context;
};

/**
 * Get the GeoStylerLocale derived from the application locale.
 * @param appLocale The application locale.
 * @returns The matching GeoStylerLocale.
 */
export const getGeoStylerLocale = (appLocale: string) => {
  let gsLocale = (locale as Record<string, GeoStylerLocale>)[appLocale];
  if (!gsLocale) {
    const localeKeys = Object.keys(locale);
    const localeKey = localeKeys.find(
      l => l.split('_')[0].toLowerCase() === appLocale.toLowerCase(),
    );
    gsLocale = localeKey
      ? (locale as Record<string, GeoStylerLocale>)[localeKey]
      : locale.en_US;
  }
  return gsLocale;
};

/**
 * Get the default style depending on given geometry types.
 * @param geomTypes List of distinct geometry types.
 * @param styleName Name of the style.
 * @param ruleName Name of the rule.
 * @returns GeoStylerStyle.
 */
export const getDefaultStyle = (
  geomTypes: GeoJsonGeometryTypes[] = [],
  styleName: string,
  ruleName: string,
  theme: SupersetTheme,
) => {
  const symbolizers: Symbolizer[] = [];
  if (geomTypes.includes('Polygon') || geomTypes.includes('MultiPolygon')) {
    symbolizers.push({
      kind: 'Fill',
      // eslint-disable-next-line theme-colors/no-literal-colors
      color: theme.colorTextBase,
    });
  }
  if (
    geomTypes.includes('LineString') ||
    geomTypes.includes('MultiLineString')
  ) {
    symbolizers.push({
      kind: 'Line',
      // eslint-disable-next-line theme-colors/no-literal-colors
      color: theme.colorTextBase,
      width: 2,
    });
  }
  if (geomTypes.includes('Point') || geomTypes.includes('MultiPoint')) {
    symbolizers.push({
      kind: 'Mark',
      wellKnownName: 'circle',
      // eslint-disable-next-line theme-colors/no-literal-colors
      color: theme.colorTextBase,
    });
  }
  const style: Style = {
    name: styleName,
    rules: [
      {
        name: ruleName,
        symbolizers,
      },
    ],
  };
  return style;
};

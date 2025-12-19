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

/**
 * Util for layer related operations.
 */

import OlParser from 'geostyler-openlayers-parser';
import TileLayer from 'ol/layer/Tile';
import TileWMS from 'ol/source/TileWMS';
import { bbox as bboxStrategy } from 'ol/loadingstrategy';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import XyzSource from 'ol/source/XYZ';
import GeoJSON from 'ol/format/GeoJSON';
import { WmsLayerConf, WfsLayerConf, LayerConf, XyzLayerConf } from '../types';
import { isWfsLayerConf, isWmsLayerConf, isXyzLayerConf } from '../typeguards';
import { isVersionBelow } from './serviceUtil';

/**
 * Create a WMS layer.
 *
 * @param wmsLayerConf The layer configuration
 *
 * @returns The created WMS layer
 */
export const createWmsLayer = (wmsLayerConf: WmsLayerConf) => {
  const { url, layersParam, version, attribution } = wmsLayerConf;
  return new TileLayer({
    source: new TileWMS({
      url,
      params: {
        LAYERS: layersParam,
        VERSION: version,
      },
      attributions: attribution,
    }),
  });
};

/**
 * Create a XYZ layer.
 *
 * @param xyzLayerConf The layer configuration
 *
 * @returns The created XYZ layer
 */
export const createXyzLayer = (xyzLayerConf: XyzLayerConf) => {
  const { url, attribution } = xyzLayerConf;
  return new TileLayer({
    source: new XyzSource({
      url,
      attributions: attribution,
    }),
  });
};

/**
 * Create a WFS layer.
 *
 * @param wfsLayerConf The layer configuration
 *
 * @returns The created WFS layer
 */
export const createWfsLayer = async (wfsLayerConf: WfsLayerConf) => {
  const {
    url,
    typeName,
    maxFeatures,
    version = '1.1.0',
    style,
    attribution,
  } = wfsLayerConf;

  const wfsSource = new VectorSource({
    format: new GeoJSON(),
    attributions: attribution,
    url: extent => {
      const requestUrl = new URL(url);
      const params = requestUrl.searchParams;
      params.append('service', 'wfs');
      params.append('request', 'GetFeature');
      params.append('outputFormat', 'application/json');
      // TODO: make CRS configurable or take it from Ol Map
      params.append('srsName', 'EPSG:3857');
      params.append('version', version);

      let typeNameQuery = 'typeNames';
      if (isVersionBelow(version, '2.0.0', 'WFS')) {
        typeNameQuery = 'typeName';
      }
      params.append(typeNameQuery, typeName);

      params.append('bbox', extent.join(','));
      if (maxFeatures) {
        let maxFeaturesQuery = 'count';
        if (isVersionBelow(version, '2.0.0', 'WFS')) {
          maxFeaturesQuery = 'maxFeatures';
        }
        params.append(maxFeaturesQuery, maxFeatures.toString());
      }

      return requestUrl.toString();
    },
    strategy: bboxStrategy,
  });

  let writeStyleResult;
  if (style) {
    const olParser = new OlParser();
    writeStyleResult = await olParser.writeStyle(style);
    if (writeStyleResult.errors) {
      console.warn('Could not create ol-style', writeStyleResult.errors);
      return undefined;
    }
  }

  return new VectorLayer({
    source: wfsSource,
    // @ts-ignore
    style: writeStyleResult?.output,
  });
};

/**
 * Create a layer instance with the provided configuration.
 *
 * @param layerConf The layer configuration
 *
 * @returns The created layer
 */
export const createLayer = async (layerConf: LayerConf) => {
  let layer;
  if (isWmsLayerConf(layerConf)) {
    layer = createWmsLayer(layerConf);
  } else if (isWfsLayerConf(layerConf)) {
    layer = await createWfsLayer(layerConf);
  } else if (isXyzLayerConf(layerConf)) {
    layer = createXyzLayer(layerConf);
  } else {
    console.warn('Provided layerconfig is not recognized');
  }
  return layer;
};

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
import { t, ChartMetadata, ChartPlugin } from '@superset-ui/core';
import buildQuery from './buildQuery';
import controlPanel from './controlPanel';
import transformProps from './transformProps';
import thumbnail from '../images/thumbnail.png';
import example1 from '../images/example1.png';
import example2 from '../images/example2.png';
import { CartodiagramPluginConstructorOpts } from '../types';
import { getLayerConfig } from '../util/controlPanelUtil';
import { getMapDefaultLayers } from '../util/bootstrapDataUtil';

export default class CartodiagramPlugin extends ChartPlugin {
  constructor(opts: CartodiagramPluginConstructorOpts) {
    const metadata = new ChartMetadata({
      description:
        'Display charts on a map. For using this plugin, users first have to create any other chart that can then be placed on the map.',
      name: t('Cartodiagram'),
      thumbnail,
      tags: [t('Geo'), t('2D'), t('Spatial'), t('Experimental')],
      category: t('Map'),
      exampleGallery: [
        { url: example1, caption: t('Pie charts on a map') },
        { url: example2, caption: t('Line charts on a map') },
      ],
    });

    const layerConfig = getLayerConfig(controlPanel);
    const mapDefaultLayers = getMapDefaultLayers();
    if (layerConfig) {
      if (mapDefaultLayers.length > 0) {
        layerConfig.config.default = mapDefaultLayers;
      }
      if (opts?.defaultLayers) {
        // eslint-disable-next-line no-console
        console.error(
          'Warning: [ThematicMapPlugin] Setting defaultLayers via MainPreset.js is deprecated. Please use MAP_DEFAULT_LAYERS in your config file instead.',
        );
        layerConfig.config.default = opts.defaultLayers;
      }
    }

    super({
      buildQuery,
      controlPanel,
      loadChart: () => import('../CartodiagramPlugin'),
      metadata,
      transformProps,
    });
  }
}

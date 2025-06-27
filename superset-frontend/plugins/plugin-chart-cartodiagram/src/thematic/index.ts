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
import thumbnail from './images/thumbnail.png';
import example1 from './images/example1.png';
import { ThematicMapPluginConstructorOpts } from './types';
import { getLayerConfig } from '../util/controlPanelUtil';
import { getDefaultStyle } from '../util/layerUtil';
import {
  getMapDefaultLayers,
  getMapProjections,
} from '../util/bootstrapDataUtil';
import { registerMapProjections } from '../util/mapUtil';

export default class ThematicMapPlugin extends ChartPlugin {
  /**
   * The constructor is used to pass relevant metadata and callbacks that get
   * registered in respective registries that are used throughout the library
   * and application. A more thorough description of each property is given in
   * the respective imported file.
   *
   * It is worth noting that `buildQuery` and is optional, and only needed for
   * advanced visualizations that require either post processing operations
   * (pivoting, rolling aggregations, sorting etc) or submitting multiple queries.
   */
  constructor(opts: ThematicMapPluginConstructorOpts) {
    const metadata = new ChartMetadata({
      description: t('Create thematic maps.'),
      name: t('Thematic Map'),
      thumbnail,
      tags: [t('Geo'), t('2D'), t('Spatial'), t('Experimental')],
      category: t('Map'),
      exampleGallery: [{ url: example1, caption: t('Proportional symbols') }],
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

      layerConfig.config.default.unshift({
        type: 'DATA',
        title: t('Data Layer'),
        style: getDefaultStyle(),
      });
    }

    const mapProjections = getMapProjections();
    registerMapProjections(mapProjections);

    super({
      buildQuery,
      controlPanel,
      loadChart: () => import('./ThematicMapPlugin'),
      metadata,
      transformProps,
    });
  }
}

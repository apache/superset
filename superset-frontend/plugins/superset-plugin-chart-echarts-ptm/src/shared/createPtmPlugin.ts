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
import { t, ChartMetadata, ChartPlugin, ChartProps } from '@superset-ui/core';
import { ControlPanelConfig, ControlSetRow } from '@superset-ui/chart-controls';
import { ComponentType } from 'react';
import { createPtmControlSection } from './ptmControlSection';
import { wrapTransformProps } from './wrapTransformProps';
import {
  type TransformConfig,
  resolveTransformConfig,
} from './transformHelpers';

export interface PtmPluginConfig {
  name: string;
  description: string;
  category?: string;
  tags?: string[];
  thumbnail: string;

  base: {
    buildQuery: any;
    transformProps: (chartProps: ChartProps) => Record<string, unknown>;
    controlPanel: ControlPanelConfig;
    Chart: ComponentType<unknown>;
  };

  ptmDefaults: Record<string, unknown>;

  transforms?: TransformConfig;

  additionalPtmControls?: ControlSetRow[];
  
  pluginTransform?: (
    options: Record<string, unknown>,
    formData: Record<string, unknown>,
    transforms: TransformConfig,
  ) => Record<string, unknown>;
  
}


export function createPtmPlugin(config: PtmPluginConfig): typeof ChartPlugin {
  const {
    name,
    description,
    category = t('Portal Telemedicina'),
    tags = [],
    thumbnail,
    base,
    ptmDefaults,
    transforms: transformsConfig,
    additionalPtmControls = [],
  } = config;

  const wrappedTransformProps = wrapTransformProps(
    base.transformProps as (chartProps: ChartProps) => Record<string, unknown>,
    {
      ptmDefaults,
      transforms: transformsConfig,
      pluginTransform: config.pluginTransform,
    },
  );

  const finalTransforms = resolveTransformConfig(transformsConfig);


  const ptmSection = createPtmControlSection(finalTransforms, additionalPtmControls);
  const extendedControlPanel: ControlPanelConfig = {
    ...base.controlPanel,
    controlPanelSections: [
      ...(base.controlPanel.controlPanelSections || []),
      ptmSection,
    ],
  };

  return class PtmChartPlugin extends ChartPlugin {
    constructor() {
      const metadata = new ChartMetadata({
        name: t(name),
        description: t(description),
        category: t(category),
        tags: [t('PTM'), t('Portal Telemedicina'), ...tags.map(tag => t(tag))],
        thumbnail,
      });

      super({
        metadata,
        buildQuery: base.buildQuery,
        controlPanel: extendedControlPanel,
        transformProps: wrappedTransformProps,
        loadChart: () => Promise.resolve(base.Chart),
      });
    }
  };
}

export default createPtmPlugin;

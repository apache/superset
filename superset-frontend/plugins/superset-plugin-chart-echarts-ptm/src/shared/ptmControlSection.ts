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
import { t } from '@superset-ui/core';
import {
  ControlPanelSectionConfig,
  ControlSetRow,
} from '@superset-ui/chart-controls';
import { type TransformConfig } from './transformHelpers/transformRegistry';


export const ptmColorPaletteChoices: [string, string][] = [
  ['blue', t('Azul (Padrão)')],
  ['green', t('Verde (Crescimento)')],
  ['red', t('Vermelho (Alerta)')],
  ['teal', t('Teal (Alternativo)')],
  ['yellow', t('Amarelo (Atenção)')],
  ['mixed', t('Multicolorido')],
];

export const ptmColorOrderChoices: [string, string][] = [
  ['normal', t('Normal')],
  ['reverse', t('Invertido')],
  ['light-to-dark', t('Claro → Escuro')],
  ['dark-to-light', t('Escuro → Claro')],
];

export const ptmColorPaletteControl: ControlSetRow = [
  {
    name: 'ptm_color_palette',
    config: {
      type: 'SelectControl',
      label: t('PTM Color Palette'),
      description: t(
        'Choose a color palette for your chart. Each palette is optimized for different purposes.',
      ),
      default: 'blue',
      clearable: false,
      choices: ptmColorPaletteChoices,
      renderTrigger: true,
    },
  },
  {
    name: 'ptm_color_order',
    config: {
      type: 'SelectControl',
      label: t('Color Order'),
      description: t(
        'Control the order in which colors from the palette are applied to series/slices.',
      ),
      default: 'normal',
      clearable: false,
      choices: ptmColorOrderChoices,
      renderTrigger: true,
    },
  },
];

export const ptmJsonOverrideControl: ControlSetRow = [
  {
    name: 'ptm_options_json',
    config: {
      type: 'TextAreaControl',
      label: t('PTM ECharts JSON Overrides'),
      description: t(
        'Advanced: JSON object to deep-merge into final ECharts options. ' +
        'Allows fine-grained control over any ECharts property. ' +
        'Example: {"series": [{"itemStyle": {"borderRadius": 4}}]}',
      ),
      default: '',
      language: 'json',
      renderTrigger: true,
    },
  },
];


export function createPtmControlSection(
  transforms: TransformConfig,
  pluginControls: ControlSetRow[] = [],
): ControlPanelSectionConfig {
  const controlSetRows: ControlSetRow[] = [];

  if (transforms.colorPalette !== false) {
    controlSetRows.push(ptmColorPaletteControl);
  }

  if (pluginControls.length > 0) {
    controlSetRows.push(...pluginControls);
  }

  if (transforms.userOverrides !== false) {
    controlSetRows.push(ptmJsonOverrideControl);
  }

  return {
    label: t('Portal Telemedicina'),
    expanded: true,
    controlSetRows,
  };
}

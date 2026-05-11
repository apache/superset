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
import { ControlSetItem } from '@superset-ui/chart-controls';
import { t } from '@apache-superset/core/translation';

export const templateControlSetItem: ControlSetItem = {
  name: 'template',
  config: {
    type: 'SelectControl',
    label: t('Sandpack Template'),
    description: t('Sandpack runtime template used to bundle the app.'),
    default: 'react',
    renderTrigger: true,
    clearable: false,
    choices: [
      ['react', t('React (JS)')],
      ['react-ts', t('React (TypeScript)')],
      ['vanilla', t('Vanilla JS')],
      ['vanilla-ts', t('Vanilla TypeScript')],
    ],
  },
};

export const layoutControlSetItem: ControlSetItem = {
  name: 'layout',
  config: {
    type: 'SelectControl',
    label: t('Layout'),
    description: t('Which Sandpack panes to show inside the chart frame.'),
    default: 'preview',
    renderTrigger: true,
    clearable: false,
    choices: [
      ['preview', t('Preview only')],
      ['split', t('Editor + preview')],
      ['editor', t('Editor only')],
    ],
  },
};

export const showNavigatorControlSetItem: ControlSetItem = {
  name: 'showNavigator',
  config: {
    type: 'CheckboxControl',
    label: t('Show navigator'),
    description: t('Display the Sandpack URL/navigator bar above the preview.'),
    default: false,
    renderTrigger: true,
  },
};

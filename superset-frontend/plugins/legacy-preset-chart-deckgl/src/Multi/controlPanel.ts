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
import { t } from '@apache-superset/core';
import { validateNonEmpty } from '@superset-ui/core';
import { viewport, mapboxStyle, autozoom } from '../utilities/Shared_DeckGL';

export default {
  controlPanelSections: [
    {
      label: t('Map'),
      expanded: true,
      controlSetRows: [
        [mapboxStyle],
        [viewport],
        [autozoom],
        [
          {
            name: 'deck_slices',
            config: {
              type: 'SelectAsyncControl',
              multi: true,
              label: t('deck.gl layers (charts)'),
              validators: [validateNonEmpty],
              default: [],
              description: t(
                'Select layers in the order you want them stacked. First selected appears at the bottom.Layers let you combine multiple visualizations on one map. Each layer is a saved deck.gl chart (like scatter plots, polygons, or arcs) that displays different data or insights. Stack them to reveal patterns and relationships across your data.',
              ),
              dataEndpoint:
                'api/v1/chart/?q=(filters:!((col:viz_type,opr:sw,value:deck)))',
              placeholder: t('Select charts'),
              onAsyncErrorMessage: t('Error while fetching charts'),
              mutator: (
                data: {
                  result?: { id: number; slice_name: string }[];
                },
                value: number[] | undefined,
              ) => {
                if (!data?.result) {
                  return [];
                }
                const selectedIds = Array.isArray(value) ? value : [];

                return data.result.map(o => {
                  const selectedIndex = selectedIds.indexOf(o.id);
                  const indexLabel =
                    selectedIndex !== -1 ? ` [${selectedIndex + 1}]` : '';

                  return {
                    value: o.id,
                    label: `${o.slice_name}${indexLabel}`,
                  };
                });
              },
            },
          },
          null,
        ],
      ],
    },
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [['adhoc_filters']],
    },
  ],
};

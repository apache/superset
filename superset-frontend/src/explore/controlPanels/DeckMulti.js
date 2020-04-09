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
import { t } from '@superset-ui/translation';
import { nonEmpty } from '../validators';
import { viewport } from './Shared_DeckGL';

export default {
  requiresTime: true,
  controlPanelSections: [
    {
      label: t('Map'),
      expanded: true,
      controlSetRows: [
        ['mapbox_style', viewport],
        [
          {
            name: 'deck_slices',
            config: {
              type: 'SelectAsyncControl',
              multi: true,
              label: t('deck.gl charts'),
              validators: [nonEmpty],
              default: [],
              description: t(
                'Pick a set of deck.gl charts to layer on top of one another',
              ),
              dataEndpoint:
                '/sliceasync/api/read?_flt_0_viz_type=deck_&_flt_7_viz_type=deck_multi',
              placeholder: t('Select charts'),
              onAsyncErrorMessage: t('Error while fetching charts'),
              mutator: data => {
                if (!data || !data.result) {
                  return [];
                }
                return data.result.map(o => ({
                  value: o.id,
                  label: o.slice_name,
                }));
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

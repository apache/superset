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

import { t } from '@apache-superset/core/translation';
import { ensureIsArray, validateNonEmpty } from '@superset-ui/core';
import { getStandardizedControls } from '@superset-ui/chart-controls';
import { defineChart } from '@superset-ui/glyph-core';
import example from './images/chord.jpg';
import exampleDark from './images/chord-dark.jpg';
import thumbnail from './images/thumbnail.png';
import thumbnailDark from './images/thumbnail-dark.png';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ReactChord = require('./ReactChord').default;

type ChordExtra = {
  colorScheme: string;
  numberFormat: string;
  sliceId: number;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default defineChart<any, ChordExtra>({
  metadata: {
    name: t('Chord Diagram'),
    description: t(
      'Showcases the flow or link between categories using thickness of chords. The value and corresponding thickness can be different for each side.',
    ),
    category: t('Flow'),
    credits: ['https://github.com/d3/d3-chord'],
    tags: [t('Circular'), t('Legacy'), t('Proportional'), t('Relational')],
    thumbnail,
    thumbnailDark,
    exampleGallery: [
      {
        url: example,
        urlDark: exampleDark,
        caption: t('Relationships between community channels'),
      },
    ],
    useLegacyApi: true,
  },
  arguments: {},
  additionalControls: {
    queryBefore: [['groupby'], ['columns'], ['metric']],
    query: [['row_limit'], ['sort_by_metric']],
    chartOptions: [['y_axis_format', null], ['color_scheme']],
  },
  additionalControlOverrides: {
    y_axis_format: {
      label: t('Number format'),
      description: t('Choose a number format'),
    },
    groupby: {
      label: t('Source'),
      multi: false,
      validators: [validateNonEmpty],
      description: t('Choose a source'),
    },
    columns: {
      label: t('Target'),
      multi: false,
      validators: [validateNonEmpty],
      description: t('Choose a target'),
    },
  },
  formDataOverrides: formData => {
    const groupby = getStandardizedControls()
      .popAllColumns()
      .filter(
        (col: string) =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          !ensureIsArray((formData as any).columns).includes(col),
      );
    return {
      ...formData,
      groupby,
      metric: getStandardizedControls().shiftMetric(),
    };
  },
  transform: chartProps => {
    const { formData } = chartProps;
    const { yAxisFormat, colorScheme, sliceId } = formData as Record<
      string,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      any
    >;
    return {
      colorScheme: colorScheme ?? '',
      numberFormat: yAxisFormat ?? '',
      sliceId: sliceId ?? 0,
    };
  },
  render: ({ width, height, data, colorScheme, numberFormat, sliceId }) => (
    <ReactChord
      width={width}
      height={height}
      data={data}
      colorScheme={colorScheme}
      numberFormat={numberFormat}
      sliceId={sliceId}
    />
  ),
});

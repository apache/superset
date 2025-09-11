/*
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
import transformProps from './transformProps';
import buildQuery from './buildQuery';
import { WordCloudFormData } from '../types';
import thumbnail from '../images/thumbnail.png';
import thumbnailDark from '../images/thumbnail-dark.png';
import example1 from '../images/Word_Cloud.jpg';
import example1Dark from '../images/Word_Cloud-dark.jpg';
import example2 from '../images/Word_Cloud_2.jpg';
import example2Dark from '../images/Word_Cloud_2-dark.jpg';
import controlPanel from './controlPanel';
import configureEncodable from '../configureEncodable';

configureEncodable();

const metadata = new ChartMetadata({
  category: t('Ranking'),
  credits: ['https://github.com/jasondavies/d3-cloud'],
  description: t(
    'Visualizes the words in a column that appear the most often. Bigger font corresponds to higher frequency.',
  ),
  exampleGallery: [
    { url: example1, urlDark: example1Dark },
    { url: example2, urlDark: example2Dark },
  ],
  name: t('Word Cloud'),
  tags: [t('Categorical'), t('Comparison'), t('Density'), t('Single Metric')],
  thumbnail,
  thumbnailDark,
});

export default class WordCloudChartPlugin extends ChartPlugin<WordCloudFormData> {
  constructor() {
    super({
      buildQuery,
      loadChart: () => import('../chart/WordCloud'),
      metadata,
      transformProps,
      controlPanel,
    });
  }
}

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

import SequentialScheme from '../../SequentialScheme';

const schemes = [
  {
    id: 'blue_white_yellow',
    label: 'blue/white/yellow',
    colors: ['#00d1c1', 'white', '#ffb400'],
  },
  {
    id: 'fire',
    colors: ['white', 'yellow', 'red', 'black'],
  },
  {
    id: 'white_black',
    label: 'white/black',
    colors: ['white', 'black'],
  },
  {
    id: 'black_white',
    label: 'black/white',
    colors: ['black', 'white'],
  },
  {
    id: 'dark_blue',
    label: 'dark blues',
    colors: ['#EBF5F8', '#6BB1CC', '#357E9B', '#1B4150', '#092935'],
  },
  {
    id: 'pink_grey',
    label: 'pink/grey',
    isDiverging: true,
    colors: ['#E70B81', '#FAFAFA', '#666666'],
  },
  {
    id: 'greens',
    colors: ['#ffffcc', '#78c679', '#006837'],
  },
  {
    id: 'purples',
    colors: ['#f2f0f7', '#9e9ac8', '#54278f'],
  },
  {
    id: 'oranges',
    colors: ['#fef0d9', '#fc8d59', '#b30000'],
  },
  {
    id: 'red_yellow_blue',
    label: 'red/yellow/blue',
    isDiverging: true,
    colors: ['#d7191c', '#fdae61', '#ffffbf', '#abd9e9', '#2c7bb6'],
  },
  {
    id: 'brown_white_green',
    label: 'brown/white/green',
    isDiverging: true,
    colors: ['#a6611a', '#dfc27d', '#f5f5f5', '#80cdc1', '#018571'],
  },
  {
    id: 'purple_white_green',
    label: 'purple/white/green',
    isDiverging: true,
    colors: ['#7b3294', '#c2a5cf', '#f7f7f7', '#a6dba0', '#008837'],
  },
  {
    id: 'superset_seq_1',
    label: 'Superset Sequential #1',
    isDiverging: false,
    colors: [
      '#F4FAD4',
      '#D7F1AC',
      '#A9E3AF',
      '#82CDBB',
      '#63C1BF',
      '#1FA8C9',
      '#2367AC',
      '#2A2D84',
      '#251354',
      '#050415',
    ],
  },
  {
    id: 'superset_seq_2',
    label: 'Superset Sequential #2',
    isDiverging: false,
    colors: [
      '#FBF1B4',
      '#FDD093',
      '#FEAD71',
      '#FF7F44',
      '#E04355',
      '#C53D6F',
      '#952B7B',
      '#4F167B',
      '#251354',
      '#050415',
    ],
  },
  {
    id: 'superset_div_1',
    label: 'Superset Diverging #1',
    isDiverging: false,
    colors: [
      '#E04355',
      '#E87180',
      '#EFA1AA',
      '#F7D0D4',
      '#F6F6F7',
      '#C8E9F1',
      '#8FD3E4',
      '#58BDD7',
      '#1FA8C9',
    ],
  },
  {
    id: 'superset_div_2',
    label: 'Superset Diverging #2',
    isDiverging: false,
    colors: [
      '#FF7F44',
      '#FF9E72',
      '#FEC0A1',
      '#FFDFD0',
      '#F6F6F7',
      '#C8E9F1',
      '#8FD3E4',
      '#58BDD7',
      '#1FA8C9',
    ],
  },
  {
    id: 'preset_seq_1',
    label: 'Preset Sequential #1',
    isDiverging: false,
    colors: [
      '#F3FAEB',
      '#DEF2D7',
      '#CAEAC4',
      '#98DEBC',
      '#69D3B5',
      '#4AA59D',
      '#287886',
      '#0D5B6A',
      '#03273F',
      '#03273F',
    ],
  },
  {
    id: 'preset_seq_2',
    label: 'Preset Sequential #2',
    isDiverging: false,
    colors: [
      '#FEECE8',
      '#FDE2DA',
      '#FCCEC2',
      '#F998AA',
      '#F76896',
      '#D13186',
      '#AC0378',
      '#790071',
      '#43026C',
      '#050415',
    ],
  },
  {
    id: 'preset_div_1',
    label: 'Preset Diverging #1',
    isDiverging: false,
    colors: [
      '#B17BAA',
      '#C59DC0',
      '#D9BDD5',
      '#D9BDD5',
      '#F6F6F7',
      '#CBEFE5',
      '#98DECA',
      '#64D0B0',
      '#32BE96',
    ],
  },
  {
    id: 'preset_div_2',
    label: 'Preset Diverging #2',
    isDiverging: false,
    colors: [
      '#CB5171',
      '#D87C94',
      '#E5A8B7',
      '#F2D3DB',
      '#F6F6F7',
      '#CEE8EC',
      '#9CD1D8',
      '#6CBAC6',
      '#3AA3B2',
    ],
  },
  {
    id: 'echarts_gradient',
    label: 'ECharts gradient',
    isDiverging: false,
    colors: ['#f6EFA6', '#D88273', '#BF444C'],
  },
  {
    id: 'deck_gl_heatmap_gradient',
    label: 'Deck.gl Heatmap Default',
    colors: ['#bd0026', '#f03b20', '#fd8d3c', '#feb24c', '#fed976', '#ffffb2'],
  },
].map(s => new SequentialScheme(s));

export default schemes;

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
import { TreeSeriesOption } from 'echarts';
import { EchartsTreeFormData } from './types';

export const DEFAULT_TREE_SERIES_OPTION: TreeSeriesOption = {
  label: {
    position: 'left',
    fontSize: 15,
  },
  animation: true,
  animationDuration: 500,
  animationEasing: 'cubicOut',
  lineStyle: { color: 'source', width: 1.5 },
};

export const DEFAULT_FORM_DATA: Partial<EchartsTreeFormData> = {
  id: '',
  parent: '',
  name: '',
  rootNodeId: '',
  layout: 'orthogonal',
  orient: 'LR',
  symbol: 'emptyCircle',
  symbolSize: 7,
  roam: true,
  nodeLabelPosition: 'left',
  childLabelPosition: 'bottom',
  emphasis: 'descendant',
};

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

import {
  createEncoderFactory,
  Encoder,
  DeriveEncoding,
  DeriveChannelOutputs,
} from 'encodable';

export type ScatterPlotEncodingConfig = {
  x: ['X', number];
  y: ['Y', number];
  fill: ['Color', string];
  group: ['Category', string, 'multiple'];
  size: ['Numeric', number];
  stroke: ['Color', string];
  tooltip: ['Text', string, 'multiple'];
};

export const scatterPlotEncoderFactory =
  createEncoderFactory<ScatterPlotEncodingConfig>({
    channelTypes: {
      x: 'X',
      y: 'Y',
      fill: 'Color',
      group: 'Category',
      size: 'Numeric',
      stroke: 'Color',
      tooltip: 'Text',
    },
    defaultEncoding: {
      x: { field: 'x', type: 'quantitative' },
      y: { field: 'y', type: 'quantitative' },
      fill: { value: '#222' },
      group: [],
      size: { value: 5 },
      stroke: { value: 'none' },
      tooltip: [],
    },
  });

export type ScatterPlotEncoding = DeriveEncoding<ScatterPlotEncodingConfig>;

export type ScatterPlotEncoder = Encoder<ScatterPlotEncodingConfig>;

export type ScatterPlotChannelOutputs =
  DeriveChannelOutputs<ScatterPlotEncodingConfig>;

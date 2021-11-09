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
  DeriveEncoding,
  Encoder,
  DeriveChannelOutputs,
} from 'encodable';

type ChoroplethMapEncodingConfig = {
  key: ['Text', string];
  fill: ['Color', string];
  opacity: ['Numeric', number];
  stroke: ['Color', string];
  strokeWidth: ['Numeric', number];
  tooltip: ['Text', string, 'multiple'];
};

export type ChoroplethMapEncoding = DeriveEncoding<ChoroplethMapEncodingConfig>;

export type ChoroplethMapEncoder = Encoder<ChoroplethMapEncodingConfig>;

export type ChoroplethMapChannelOutputs =
  DeriveChannelOutputs<ChoroplethMapEncodingConfig>;

export const DefaultChannelOutputs = {
  key: '',
  fill: '#f0f0f0',
  opacity: 1,
  stroke: '#ccc',
  strokeWidth: 1,
};

export const choroplethMapEncoderFactory =
  createEncoderFactory<ChoroplethMapEncodingConfig>({
    channelTypes: {
      key: 'Text',
      fill: 'Color',
      opacity: 'Numeric',
      stroke: 'Color',
      strokeWidth: 'Numeric',
      tooltip: 'Text',
    },
    defaultEncoding: {
      key: { field: 'key', title: 'Location' },
      fill: { value: DefaultChannelOutputs.fill },
      opacity: { value: DefaultChannelOutputs.opacity },
      stroke: { value: DefaultChannelOutputs.stroke },
      strokeWidth: { value: DefaultChannelOutputs.strokeWidth },
      tooltip: [],
    },
  });

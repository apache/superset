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
import { GenericDataType } from '@superset-ui/core';

export const INPUT_HEIGHT = 32;

export const INPUT_WIDTH = 270;

export const TIME_FILTER_INPUT_WIDTH = 350;

export const FILTER_SUPPORTED_TYPES = {
  filter_time: [GenericDataType.Temporal],
  filter_timegrain: [GenericDataType.Temporal],
  filter_timecolumn: [GenericDataType.Temporal],
  filter_select: [
    GenericDataType.Boolean,
    GenericDataType.String,
    GenericDataType.Numeric,
    GenericDataType.Temporal,
  ],
  filter_range: [GenericDataType.Numeric],
};

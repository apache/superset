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
/* eslint-disable no-underscore-dangle */

import { QueryFormData } from './types';
import { TimeGranularity } from '../time-format';

export default function extractTimegrain(
  formData: QueryFormData,
): TimeGranularity | undefined {
  const { time_grain_sqla, extra_filters, extra_form_data } = formData;
  if (extra_form_data?.time_grain_sqla) {
    return extra_form_data.time_grain_sqla;
  }
  const extra_grain = (extra_filters || []).filter(
    filter => filter.col === '__time_grain',
  );
  if (extra_grain.length) {
    return extra_grain[0].val as TimeGranularity;
  }
  return time_grain_sqla;
}

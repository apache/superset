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

import { TimeLocaleDefinition } from 'd3-time-format';
import createMultiFormatter from '../factories/createMultiFormatter';
import { SmartDateFormat } from '../types';
import { DEFAULT_SMART_DATE_FORMAT } from '../SmartDateFormatConfig';

export const SMART_DATE_ID = 'smart_date';

export function createSmartDateFormatter(
  locale?: TimeLocaleDefinition,
  formats?: SmartDateFormat,
) {
  return createMultiFormatter({
    id: SMART_DATE_ID,
    label: 'Adaptative Formatting',
    formats: formats?.[SMART_DATE_ID]
      ? formats?.[SMART_DATE_ID]
      : DEFAULT_SMART_DATE_FORMAT[SMART_DATE_ID],
    locale,
  });
}

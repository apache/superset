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
import { FormatLocaleDefinition } from 'd3-format';
import { makeSingleton } from '../utils';
import NumberFormatterRegistry from './NumberFormatterRegistry';

const getInstance = makeSingleton(NumberFormatterRegistry);

export default getInstance;

export function getNumberFormatter(format?: string) {
  return getInstance().get(format);
}

export function setD3Format(d3Format: Partial<FormatLocaleDefinition>) {
  getInstance().setD3Format(d3Format);
}

export function formatNumber(
  format: string | undefined,
  value: number | null | undefined,
) {
  return getInstance().format(format, value);
}

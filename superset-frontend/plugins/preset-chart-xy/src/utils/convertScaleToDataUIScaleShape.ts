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

import { Value, ScaleConfig } from 'encodable';

type DataUIScaleType = 'time' | 'timeUtc' | 'linear' | 'band';

interface DataUIScale {
  type: DataUIScaleType;
  domain?: number[] | string[];
  includeZero?: boolean;
  nice?: boolean;
  paddingInner?: number;
  paddingOuter?: number;
  range?: number[] | string[];
  rangeRound?: number[] | string[];
}

function isCompatibleDomainOrRange(
  array: ScaleConfig['domain'] | ScaleConfig['range'],
): array is number[] | string[] {
  return (
    typeof array !== 'undefined' &&
    array.length > 0 &&
    (typeof array[0] === 'string' || typeof array[0] === 'number')
  );
}

/**
 * Convert encodeable scale object into @data-ui's scale config
 * @param scale
 */
export default function convertScaleToDataUIScale<Output extends Value>(
  scale: ScaleConfig<Output>,
) {
  const { type, domain, range } = scale;

  let outputType: DataUIScaleType;

  if (type === 'linear' || type === 'time' || type === 'band') {
    outputType = type;
  } else if (type === 'utc') {
    outputType = 'timeUtc';
  } else {
    throw new Error(`Unsupported scale type: ${type}`);
  }

  const output: DataUIScale = { type: outputType };
  if (isCompatibleDomainOrRange(domain)) {
    output.domain = domain;
  }
  if (isCompatibleDomainOrRange(range)) {
    output.range = range;
  }
  if ('nice' in scale && typeof scale.nice === 'boolean') {
    output.nice = scale.nice;
  }
  if ('paddingInner' in scale && typeof scale.paddingInner !== 'undefined') {
    output.paddingInner = scale.paddingInner;
  }
  if ('paddingOuter' in scale && typeof scale.paddingOuter !== 'undefined') {
    output.paddingOuter = scale.paddingOuter;
  }

  return output;
}

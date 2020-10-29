/* eslint-disable no-underscore-dangle */
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
import { AnnotationOpacity, FormulaAnnotationLayer, TimeseriesDataRecord } from '@superset-ui/core';
import { parse as mathjsParse } from 'mathjs';

export function evalFormula(
  formula: FormulaAnnotationLayer,
  data: TimeseriesDataRecord[],
): [Date, number][] {
  const { value } = formula;
  const node = mathjsParse(value);
  const func = node.compile();
  return data.map(row => {
    return [new Date(Number(row.__timestamp)), func.evaluate({ x: row.__timestamp }) as number];
  });
}

export function parseAnnotationOpacity(opacity?: AnnotationOpacity): number {
  switch (opacity) {
    case 'opacityLow':
      return 0.2;
    case 'opacityMedium':
      return 0.5;
    case 'opacityHigh':
      return 0.8;
    default:
      return 1;
  }
}

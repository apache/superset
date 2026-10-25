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
import { VizType } from '@superset-ui/core';

// A KPI card shows one final number: it has no table of data worth exporting, and a PDF
// of it is the same picture as the PNG. These charts offer image exports only. Big Number with
// Trendline is not listed: its query returns the daily series, which people export.
const IMAGE_ONLY_EXPORT_VIZ_TYPES: string[] = [
  VizType.BigNumberTotal,
  VizType.BigNumberPeriodOverPeriod,
];

export default function isImageOnlyExportViz(vizType?: string): boolean {
  return !!vizType && IMAGE_ONLY_EXPORT_VIZ_TYPES.includes(vizType);
}

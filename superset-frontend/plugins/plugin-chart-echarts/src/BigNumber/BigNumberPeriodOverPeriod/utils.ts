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
import { CustomControlItem } from '@superset-ui/chart-controls';
import {
  headerFontSize,
  subheaderFontSize,
  metricNameFontSize,
  subtitleFontSize,
} from '../sharedControls';

// Define font sizes
const headerFontSizes = [16, 20, 30, 48, 60];
const standardFontSizes = [16, 20, 26, 32, 40];

// Helper function to extract proportion values from control
const extractProportionValues = (control: CustomControlItem): number[] =>
  control.config.options.map(
    (option: { label: string; value: number }) => option.value,
  );

// Extract proportion values for each control
const proportionValues = {
  metricName: extractProportionValues(metricNameFontSize),
  header: extractProportionValues(headerFontSize),
  subheader: extractProportionValues(subheaderFontSize),
  subtitle: extractProportionValues(subtitleFontSize),
};

// Create font size mapping
const getFontSizeMapping = (
  proportionValues: number[],
  actualSizes: number[],
) =>
  proportionValues.reduce<Record<number, number>>((acc, value, index) => {
    acc[value] = actualSizes[index] ?? actualSizes[actualSizes.length - 1];
    return acc;
  }, {});

// Create font size getter factory
const createFontSizeGetter = (
  proportionValues: number[],
  actualSizes: number[],
) => {
  const mapping = getFontSizeMapping(proportionValues, actualSizes);
  return (proportionValue: number) =>
    mapping[proportionValue] ?? actualSizes[actualSizes.length - 1];
};

// Export getters for each font size
export const getMetricNameFontSize = createFontSizeGetter(
  proportionValues.metricName,
  standardFontSizes,
);

export const getHeaderFontSize = createFontSizeGetter(
  proportionValues.header,
  headerFontSizes,
);

export const getComparisonFontSize = createFontSizeGetter(
  proportionValues.subheader,
  standardFontSizes,
);

export const getSubtitleFontSize = createFontSizeGetter(
  proportionValues.subtitle,
  standardFontSizes,
);

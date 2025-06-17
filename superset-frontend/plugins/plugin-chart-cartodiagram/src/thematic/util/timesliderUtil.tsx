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

import { DataRecord } from '@superset-ui/core';
import { SliderMarks } from 'antd/lib/slider';
import { FeatureCollection } from 'geojson';
import { TimesliderTooltipFormat } from '../../constants';

/**
 * Format a date based on given format.
 * @param date The date to format
 * @param format The format to use
 * @returns The formatted date
 */
export const formatDate = (date: Date, format: TimesliderTooltipFormat) => {
  let formattedDate;
  switch (format) {
    case TimesliderTooltipFormat.DATE:
      formattedDate = date.toLocaleDateString();
      break;
    case TimesliderTooltipFormat.TIME:
      formattedDate = date.toLocaleTimeString();
      break;
    case TimesliderTooltipFormat.DATETIME:
    default:
      formattedDate = date.toLocaleString();
  }
  return formattedDate;
};

const itemsToMarks = (items: number[]) =>
  items.sort().reduce(
    (acc, item: number) => ({
      ...acc,
      [item]: undefined,
    }),
    {},
  );

/**
 * Create marks from a featureCollection.
 * @param featureCollection The featureCollection
 * @param timeColumn The column containing the time values
 * @returns The marks
 */
export const featureCollectionToMarks = (
  featureCollection: FeatureCollection,
  timeColumn: string,
) => {
  const dateItems = featureCollection.features.map(
    f => f.properties?.[timeColumn],
  );

  return itemsToMarks(dateItems);
};

/**
 * Create marks from DataRecords.
 * @param dataRecords The data records
 * @param timeColumn The column containing the time values
 * @returns The marks
 */
export const dataRecordsToMarks = (
  dataRecords: DataRecord[],
  timeColumn: string,
) => {
  const dateItems = dataRecords.map(r => r[timeColumn]) as number[];
  return itemsToMarks(dateItems);
};

/**
 * Get the value of the first mark.
 * @param marks The marks
 * @returns The value of the first mark
 */
export const getFirstMark = (marks: SliderMarks) => {
  if (!marks) {
    return undefined;
  }
  const firstMark = Object.keys(marks).at(0);
  if (!firstMark) {
    return undefined;
  }
  return parseInt(firstMark, 10);
};

/**
 * Get the value of the last mark.
 * @param marks The marks
 * @returns The value of the last mark
 */
export const getLastMark = (marks: SliderMarks) => {
  if (!marks) {
    return undefined;
  }
  const lastMark = Object.keys(marks).at(-1);
  if (!lastMark) {
    return undefined;
  }
  return parseInt(lastMark, 10);
};

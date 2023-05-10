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

import { CRON_SCHEDULE } from "./constants";

export const findMinValue = (arr: any) => {
  let minValue = arr[0]; // Assume the first value is the smallest
  // eslint-disable-next-line no-plusplus
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] < minValue) {
      minValue = arr[i];
    }
  }
  return minValue;
};

export const getRangeTimeout = (minPart: string) => {
  let minArray = parseMinPart(minPart);
  const stepperArray: number[] = [];
  const commaSeparatedArray:string[] = [];
  processMinArray(minArray, stepperArray, commaSeparatedArray);
  if (commaSeparatedArray.length > 0) {
      let minValue = calculateMinDifference(commaSeparatedArray);
      stepperArray.push(minValue);
  }
  return findMinValue(stepperArray);
};

const parseMinPart = (minPart:string) => {
  if (minPart.includes(',')) {
    return minPart.split(',').map(String);
  } else {
    return [minPart];
  }
};

const processMinArray = (minArray:string[], stepperArray:number[], commaSeparatedArray:string[]) => {
    // eslint-disable-next-line no-plusplus
    for (let i = 0; i < minArray.length; i++) {
    if (minArray[i].includes('-')) {
      if (minArray[i].includes('/')) {
        const stepper = minArray[i].split('/').pop();
        stepperArray.push(Number(stepper));
      } else {
        stepperArray.push(1);
      }
    } else {
      commaSeparatedArray.push(minArray[i]);
    }
  }
};

const calculateMinDifference = (commaSeparatedArray:string[]) => {
  let minValue = Math.min();
  // eslint-disable-next-line no-plusplus
  for (let i = 1; i < commaSeparatedArray.length; i++) {
    const currDiff = Number(commaSeparatedArray[i]) - Number(commaSeparatedArray[i - 1]);
    if (currDiff < minValue) {
      minValue = currDiff;
    }
  }
  const lastDiff = 60 - Number(commaSeparatedArray[commaSeparatedArray.length - 1]) + Number(commaSeparatedArray[0]);
  if (lastDiff < minValue) {
    minValue = lastDiff;
  }
  return minValue;
};

export const getLeastTimeout = (
  minPart: string,
  defaultWorkingTimeout: number,
) => {
  switch (minPart) {
    case CRON_SCHEDULE.EVERY_HOUR:
      return Math.min(3600, defaultWorkingTimeout);
    case CRON_SCHEDULE.EVERY_MIN:
      return Math.min(60, defaultWorkingTimeout);
    default:
      if (minPart.includes(',') || minPart.includes('-')) {
        const timeout = getRangeTimeout(minPart);
        return Math.min(timeout * 60, defaultWorkingTimeout);
      }
      return defaultWorkingTimeout;
  }
};

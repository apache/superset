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

/**
 * Method to check if a number is within inclusive range between a maximum value minus a threshold
 * Invalid non numeric inputs will not error, but will return false
 *
 * @param value number coordinate to determine if it is within bounds of the targetCoordinate - threshold.  Must be positive and less than maximum.
 * @param maximum number max value for the test range.  Must be positive and greater than value
 * @param threshold number values to determine a range from maximum - threshold.  Must be positive and greater than zero.
 * @returns boolean
 */
export const withinRange = (
  value: number,
  maximum: number,
  threshold: number,
): boolean => {
  let within = false;
  const diff = maximum - value;
  if (diff > 0 && diff <= threshold) {
    within = true;
  }
  return within;
};

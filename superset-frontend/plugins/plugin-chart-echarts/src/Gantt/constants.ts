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
export const ELEMENT_HEIGHT_SCALE = 0.85 as const;

// Category names are drawn as markLine labels anchored to the start of the grid,
// which `grid.containLabel` does not account for, so the room they need is
// reserved by hand. These drive that calculation in transformProps.
export const CATEGORY_LABEL_GAP = 8 as const;
export const MAX_CATEGORY_LABEL_WIDTH_RATIO = 0.25 as const;

export enum Dimension {
  StartTime = 'startTime',
  EndTime = 'endTime',
  Index = 'index',
  SeriesCount = 'seriesCount',
}

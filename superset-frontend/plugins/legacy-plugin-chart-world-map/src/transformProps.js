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
import { rgb } from 'd3-color';

export default function transformProps(chartProps) {
  const {
    width,
    height,
    formData,
    queriesData,
    hooks,
    inContextMenu,
    filterState,
    emitCrossFilters,
  } = chartProps;
  const { onContextMenu, setDataMask } = hooks;
  const {
    countryFieldtype,
    entity,
    maxBubbleSize,
    showBubbles,
    linearColorScheme,
    colorPicker,
    colorBy,
    colorScheme,
    sliceId,
  } = formData;
  const { r, g, b } = colorPicker;

  return {
    countryFieldtype,
    entity,
    data: queriesData[0].data,
    width,
    height,
    maxBubbleSize: parseInt(maxBubbleSize, 10),
    showBubbles,
    linearColorScheme,
    color: rgb(r, g, b).hex(),
    colorBy,
    colorScheme,
    sliceId,
    onContextMenu,
    setDataMask,
    inContextMenu,
    filterState,
    emitCrossFilters,
  };
}

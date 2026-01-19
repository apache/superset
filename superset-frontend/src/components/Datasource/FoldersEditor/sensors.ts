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

import {
  PointerSensor,
  PointerSensorOptions,
  MeasuringConfiguration,
  MeasuringStrategy,
} from '@dnd-kit/core';

export const pointerSensorOptions: PointerSensorOptions = {
  activationConstraint: {
    distance: 8,
  },
};

export const createPointerSensor = () => PointerSensor;

// Use BeforeDragging strategy to measure items once at drag start rather than continuously.
// This is critical for virtualized lists where items get unmounted during scroll.
// MeasuringStrategy.Always causes issues because dnd-kit loses track of items
// that are unmounted by react-window during auto-scroll.
export const measuringConfig: MeasuringConfiguration = {
  droppable: {
    strategy: MeasuringStrategy.BeforeDragging,
  },
};

// Disable auto-scroll because it conflicts with virtualization.
// When auto-scroll moves the viewport, react-window unmounts items that scroll out of view,
// which causes dnd-kit to lose track of the dragged item and reset the drag operation.
export const autoScrollConfig = {
  enabled: false,
};

export const sensorConfig = {
  PointerSensor: createPointerSensor(),
  options: pointerSensorOptions,
};

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

/**
 * Pointer sensor configuration with activation constraints
 * This prevents accidental drags when clicking buttons or selecting text
 */
export const pointerSensorOptions: PointerSensorOptions = {
  activationConstraint: {
    distance: 8, // 8px of movement required to activate drag
  },
};

/**
 * Configure pointer sensor with our options
 */
export const createPointerSensor = () => PointerSensor;

/**
 * Measuring configuration for drag-and-drop
 * Using 'Always' strategy ensures smooth visual feedback during drag
 */
export const measuringConfig: MeasuringConfiguration = {
  droppable: {
    strategy: MeasuringStrategy.Always,
  },
};

/**
 * Export sensor configuration for use with useSensors hook
 */
export const sensorConfig = {
  PointerSensor: createPointerSensor(),
  options: pointerSensorOptions,
};

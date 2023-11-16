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

import React from 'react';
import { isFeatureEnabled, FeatureFlag } from '@superset-ui/core';

const TelemetryPixel = () => {
  console.log('TelemetryPixel', isFeatureEnabled(FeatureFlag.ENABLE_TELEMETRY))
  return  isFeatureEnabled(FeatureFlag.ENABLE_TELEMETRY) ? (
    // eslint-disable-next-line jsx-a11y/alt-text
    <img
      referrerPolicy="no-referrer-when-downgrade"
      src="https://static.scarf.sh/a.png?x-pxid=0d3461e1-abb1-4691-a0aa-5ed50de66af0"
    />
  ) : null;
  }
export default TelemetryPixel;

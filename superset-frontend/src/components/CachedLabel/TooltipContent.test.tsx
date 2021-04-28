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
import { render, screen } from 'spec/helpers/testing-library';
import moment from 'moment';
import { TooltipContent } from './TooltipContent';

test('Rendering TooltipContent correctly - no timestep', () => {
  render(<TooltipContent />);
  expect(screen.getByTestId('tooltip-content')?.textContent).toBe(
    'Loaded from cache. Click to force-refresh',
  );
});

test('Rendering TooltipContent correctly - with timestep', () => {
  render(<TooltipContent cachedTimestamp="01-01-2000" />);
  expect(screen.getByTestId('tooltip-content')?.textContent).toBe(
    `Loaded data cached ${moment
      .utc('01-01-2000')
      .fromNow()}. Click to force-refresh`,
  );
});

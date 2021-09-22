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
import { render } from 'spec/helpers/testing-library';

import MissingChart from 'src/dashboard/components/MissingChart';

type MissingChartProps = {
  height: number;
};

const setup = (overrides?: MissingChartProps) => (
  <MissingChart height={100} {...overrides} />
);

describe('MissingChart', () => {
  it('renders a .missing-chart-container', () => {
    const rendered = render(setup());

    const missingChartContainer = rendered.container.querySelector(
      '.missing-chart-container',
    );
    expect(missingChartContainer).toBeVisible();
  });

  it('renders a .missing-chart-body', () => {
    const rendered = render(setup());

    const missingChartBody = rendered.container.querySelector(
      '.missing-chart-body',
    );
    const bodyText =
      'There is no chart definition associated with this component, could it have been deleted?<br><br>Delete this container and save to remove this message.';

    expect(missingChartBody).toBeVisible();
    expect(missingChartBody?.innerHTML).toMatch(bodyText);
  });
});

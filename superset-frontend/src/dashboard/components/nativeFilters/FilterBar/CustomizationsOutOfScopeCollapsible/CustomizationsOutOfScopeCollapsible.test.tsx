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
import { render } from 'spec/helpers/testing-library';
import { ChartCustomization } from '@superset-ui/core';
import { Collapse } from '@superset-ui/core/components/Collapse';
import { outOfScopeCollapseStyles } from '../FiltersOutOfScopeCollapsible';
import { CustomizationsOutOfScopeCollapsible } from '.';

jest.mock('@superset-ui/core/components/Collapse', () => {
  const actual = jest.requireActual('@superset-ui/core/components/Collapse');
  return {
    ...actual,
    Collapse: jest.fn((props: Record<string, unknown>) => (
      <actual.Collapse {...props} />
    )),
  };
});

const customization = {
  id: 'CHART_CUSTOMIZATION-1',
  name: 'Out of scope customization',
} as ChartCustomization;

test('CustomizationsOutOfScopeCollapsible applies outOfScopeCollapseStyles to the collapse', () => {
  render(
    <CustomizationsOutOfScopeCollapsible
      customizationsOutOfScope={[customization]}
      renderer={c => <div key={c.id}>{(c as ChartCustomization).name}</div>}
    />,
  );

  const [[props]] = (Collapse as unknown as jest.Mock).mock.calls;
  expect(props.css).toBeDefined();
  expect(props.css).toBe(outOfScopeCollapseStyles);
});

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

import { FilterPluginStyle } from 'src/filters/components/common';
import { FilterPluginStyle as ChartCustomizationsFilterPluginStyle } from 'src/chartCustomizations/components/common';

test('FilterPluginStyle pins the filter value control wrapper to the inline start', () => {
  // Keeps the caret and typed text at the inline-start edge even when a
  // centered `text-align` is inherited from an ancestor. Guards against
  // regressing the wrapper-level rule back to a centered/absent value.
  const { container } = render(<FilterPluginStyle height={100} width={100} />);
  expect(container.firstChild).toHaveStyleRule('text-align', 'start');
});

test('chartCustomizations FilterPluginStyle stays in sync with the inline-start rule', () => {
  const { container } = render(
    <ChartCustomizationsFilterPluginStyle height={100} width={100} />,
  );
  expect(container.firstChild).toHaveStyleRule('text-align', 'start');
});

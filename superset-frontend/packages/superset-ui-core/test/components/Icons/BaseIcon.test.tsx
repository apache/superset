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
import '@testing-library/jest-dom';
import { SVGProps } from 'react';
import { render, screen } from '@testing-library/react';
import { SupersetTheme, ThemeProvider } from '@apache-superset/core/theme';

// Imported directly: the AsyncIcon mock in spec/helpers/shim.tsx would skip
// the custom-icon branch of BaseIconComponent.
import { BaseIconComponent } from '../../../src/components/Icons/BaseIcon';

const mockTheme = { fontSize: 16, sizeUnit: 4 } as SupersetTheme;

const StubSvg = (props: SVGProps<SVGSVGElement>) => <svg {...props} />;

test('a custom icon marked aria-hidden is hidden from assistive technology', () => {
  render(
    <ThemeProvider theme={mockTheme}>
      <button type="button">
        <BaseIconComponent
          customIcons
          component={StubSvg}
          fileName="redo"
          aria-hidden="true"
        />
      </button>
    </ThemeProvider>,
  );

  expect(screen.queryByRole('img')).not.toBeInTheDocument();
  expect(screen.getByRole('button')).toHaveAccessibleName('');
});

test('a custom icon without aria-hidden keeps its image role and name', () => {
  render(
    <ThemeProvider theme={mockTheme}>
      <BaseIconComponent customIcons component={StubSvg} fileName="redo" />
    </ThemeProvider>,
  );

  expect(screen.getByRole('img', { name: 'redo' })).toBeInTheDocument();
});

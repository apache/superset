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

import { useState } from 'react';
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import fetchMock from 'fetch-mock';
import CssTemplateModal from './CssTemplateModal';
import { TemplateObject } from './types';

const mockTemplate: TemplateObject = {
  id: 1,
  template_name: 'Existing Template',
  css: '.existing { color: red; }',
};

beforeEach(() => {
  fetchMock.clearHistory().removeRoutes();
  fetchMock.get('glob:*/api/v1/css_template/1', { result: mockTemplate });
});

afterEach(() => {
  fetchMock.removeRoutes();
});

// The Ace editor renders with the DOM id supplied via the editor's `id` prop
// (forwarded to react-ace as `name`). The CSS template modal uses
// id="css-template-editor".
const aceEditorSelector = '#css-template-editor.ace_editor';

test('renders the CSS editor field in Edit mode (guard for #38563)', async () => {
  render(
    <CssTemplateModal show onHide={() => {}} cssTemplate={mockTemplate} />,
    { useRedux: true, useTheme: true },
  );

  expect(screen.getByText('css')).toBeInTheDocument();
  await waitFor(() => {
    expect(document.querySelector(aceEditorSelector)).toBeInTheDocument();
  });
});

test('renders the CSS editor field in Add mode', async () => {
  render(<CssTemplateModal show onHide={() => {}} />, {
    useRedux: true,
    useTheme: true,
  });

  expect(await screen.findByText('Add CSS template')).toBeInTheDocument();
  expect(screen.getByText('css')).toBeInTheDocument();
  await waitFor(() => {
    expect(document.querySelector(aceEditorSelector)).toBeInTheDocument();
  });
});

test('renders the editor after closed (Add) -> open (Edit) transition', async () => {
  // Mirrors src/pages/CssTemplateList/index.tsx, where the modal is mounted
  // up-front with show=false and cssTemplate=null, then both flip together
  // when the user clicks the Edit row action.
  function Harness() {
    const [show, setShow] = useState(false);
    const [tpl, setTpl] = useState<TemplateObject | null>(null);
    return (
      <>
        <button
          type="button"
          onClick={() => {
            setTpl(mockTemplate);
            setShow(true);
          }}
        >
          open
        </button>
        <CssTemplateModal
          show={show}
          cssTemplate={tpl}
          onHide={() => setShow(false)}
        />
      </>
    );
  }

  render(<Harness />, { useRedux: true, useTheme: true });
  await userEvent.click(screen.getByText('open'));
  await waitFor(() => {
    expect(document.querySelector(aceEditorSelector)).toBeInTheDocument();
  });
});

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
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from 'spec/helpers/testing-library';
import { t } from '@apache-superset/core/translation';
import { supersetTheme } from '@apache-superset/core/theme';
import * as ace from 'ace-builds';

import ExtraOptions from './ExtraOptions';
import fetchMock from 'fetch-mock';
import { DatabaseObject } from '../types';

// The Secure extra editor hands this stand-in to onLoad, as ace hands its
// editor; every other JSON editor stays the real one.
const mockSecureExtraEditor = { resize: jest.fn() };
type MockEditorProps = {
  name?: string;
  onLoad?: (editor: typeof mockSecureExtraEditor) => void;
};
jest.mock('./styles', () => {
  const actual = jest.requireActual('./styles');
  const { createElement, useEffect } = jest.requireActual('react');
  const MockSecureExtraEditor = ({ onLoad }: MockEditorProps) => {
    useEffect(() => {
      onLoad?.(mockSecureExtraEditor);
    }, [onLoad]);
    return createElement('div', { 'data-test': 'secure-extra-editor' });
  };
  const StyledJsonEditor = (props: MockEditorProps) =>
    props.name === 'masked_encrypted_extra'
      ? createElement(MockSecureExtraEditor, props)
      : createElement(actual.StyledJsonEditor, props);
  return { ...actual, StyledJsonEditor };
});

const defaultDb = {
  expose_in_sqllab: true,
  allow_ctas: false,
  allow_cvas: false,
  allow_dml: false,
  allow_run_async: false,
  cache_timeout: 300,
  force_ctas_schema: 'public',
  masked_encrypted_extra: '',
  server_cert: '',
  impersonate_user: false,
  extra: JSON.stringify({
    cost_estimate_enabled: false,
    allows_virtual_table_explore: true,
    disable_data_preview: false,
    schema_options: { expand_rows: false },
    metadata_cache_timeout: {
      schema_cache_timeout: 600,
      table_cache_timeout: 1200,
    },
    disable_drill_to_detail: false,
    metadata_params: {},
    engine_params: {},
    version: '',
    cancel_query_on_windows_unload: false,
  }),
  engine_information: {
    supports_file_upload: true,
    supports_dynamic_catalog: true,
  },
  configuration_method: '', // added dummy value for configuration_method
  database_name: 'Test Database', // added dummy value for database_name
  driver: 'sqlite', // added dummy value for driver
  id: 1, // added dummy value for id
  sqlalchemy_uri: 'sqlite:///:memory:', // added dummy value for sqlalchemy_uri
  parameters: {}, // added dummy value for parameters
};

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('ExtraOptions Component', () => {
  const onInputChange = jest.fn();
  const onTextChange = jest.fn();
  const onEditorChange = jest.fn();
  const onExtraInputChange = jest.fn();
  const onExtraEditorChange = jest.fn();

  const renderComponent = (dbProps = defaultDb, extension = undefined) =>
    render(
      <ExtraOptions
        db={dbProps as unknown as DatabaseObject}
        onInputChange={onInputChange}
        onTextChange={onTextChange}
        onEditorChange={onEditorChange}
        onExtraInputChange={onExtraInputChange}
        onExtraEditorChange={onExtraEditorChange}
        extraExtension={extension}
      />,
      { useRedux: true },
    );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders all main panels', () => {
    renderComponent();

    expect(screen.getByText(t('SQL Lab'))).toBeInTheDocument();
    expect(screen.getByText(t('Performance'))).toBeInTheDocument();
    expect(screen.getByText(t('Security'))).toBeInTheDocument();
    expect(screen.getByText(t('Other'))).toBeInTheDocument();
  });

  test('calls onInputChange when "Expose database in SQL Lab" checkbox is clicked', () => {
    renderComponent();
    const sqlLabText = screen.getByText(t('SQL Lab'));
    fireEvent.click(sqlLabText);

    const checkbox = screen.getByLabelText(t('Expose database in SQL Lab'));
    fireEvent.click(checkbox);
    expect(onInputChange).toHaveBeenCalled();
  });

  test('calls onExtraInputChange when "Enable query cost estimation" checkbox is clicked', () => {
    renderComponent();
    const sqlLabText = screen.getByText(t('SQL Lab'));
    fireEvent.click(sqlLabText);
    const checkbox = screen.getByLabelText(t('Enable query cost estimation'));
    fireEvent.click(checkbox);
    expect(onExtraInputChange).toHaveBeenCalled();
  });

  test('calls onExtraEditorChange when metadata_params json editor changes', async () => {
    renderComponent();

    // Click to open the editor tab/section
    const otherHeader = screen.getByText(t('Other'));
    fireEvent.click(otherHeader);

    // Wait for Ace to initialize (in case it's async)
    await waitFor(() => {
      expect(document.querySelector('#metadata_params')).toBeInTheDocument();
    });

    // Grab editor instance by ID or name
    const editorInstance = ace.edit('metadata_params');

    act(() => {
      editorInstance.setValue('{"key":"value"}');
    });

    expect(onExtraEditorChange).toHaveBeenCalledWith({
      json: '{"key":"value"}',
      name: 'metadata_params',
    });

    act(() => {
      editorInstance.setValue('foo');
    });

    expect(onExtraEditorChange).toHaveBeenCalledWith({
      json: 'foo',
      name: 'metadata_params',
    });

    // it accepts invalid json strings
    act(() => {
      editorInstance.setValue('{"key":"value');
    });

    expect(onExtraEditorChange).toHaveBeenCalledWith({
      json: '{"key":"value',
      name: 'metadata_params',
    });
  });

  test('calls onTextChange when server certificate textarea is changed', () => {
    renderComponent();
    // Click to open the security tab/section
    const securityHeader = screen.getByText(t('Security'));
    fireEvent.click(securityHeader);

    const textarea = screen.getByPlaceholderText(t('Enter CA_BUNDLE'));
    fireEvent.change(textarea, { target: { value: 'new cert' } });
    expect(onTextChange).toHaveBeenCalled();
  });

  test('handles input change for schema cache timeout', () => {
    renderComponent();
    const performanceHeader = screen.getByText(t('Performance'));
    fireEvent.click(performanceHeader);
    const input = screen.getByTestId('schema-cache-timeout-test');
    fireEvent.change(input, { target: { value: '500' } });
    expect(onExtraInputChange).toHaveBeenCalled();
  });

  test('schema cache timeout input has min=0 to prevent negative values', () => {
    renderComponent();
    const performanceHeader = screen.getByText(t('Performance'));
    fireEvent.click(performanceHeader);
    const input = screen.getByTestId('schema-cache-timeout-test');
    expect(input).toHaveAttribute('min', '0');
  });

  test('schema cache timeout rejects negative values', () => {
    renderComponent();
    const performanceHeader = screen.getByText(t('Performance'));
    fireEvent.click(performanceHeader);
    const input = screen.getByTestId('schema-cache-timeout-test');
    fireEvent.change(input, {
      target: { value: '-4', name: 'schema_cache_timeout' },
    });
    expect(onExtraInputChange).not.toHaveBeenCalled();
  });

  test('handles input change for table cache timeout', () => {
    renderComponent();
    const performanceHeader = screen.getByText(t('Performance'));
    fireEvent.click(performanceHeader);
    const input = screen.getByTestId('table-cache-timeout-test');
    fireEvent.change(input, { target: { value: '1000' } });
    expect(onExtraInputChange).toHaveBeenCalled();
  });

  test('table cache timeout input has min=0 to prevent negative values', () => {
    renderComponent();
    const performanceHeader = screen.getByText(t('Performance'));
    fireEvent.click(performanceHeader);
    const input = screen.getByTestId('table-cache-timeout-test');
    expect(input).toHaveAttribute('min', '0');
  });

  test('table cache timeout rejects negative values', () => {
    renderComponent();
    const performanceHeader = screen.getByText(t('Performance'));
    fireEvent.click(performanceHeader);
    const input = screen.getByTestId('table-cache-timeout-test');
    fireEvent.change(input, {
      target: { value: '-1', name: 'table_cache_timeout' },
    });
    expect(onExtraInputChange).not.toHaveBeenCalled();
  });

  test('chart cache timeout input has min=-1', () => {
    renderComponent();
    const performanceHeader = screen.getByText(t('Performance'));
    fireEvent.click(performanceHeader);
    const input = screen.getByTestId('cache-timeout-test');
    expect(input).toHaveAttribute('min', '-1');
  });

  test('chart cache timeout allows -1 (bypass cache)', () => {
    renderComponent();
    const performanceHeader = screen.getByText(t('Performance'));
    fireEvent.click(performanceHeader);
    const input = screen.getByTestId('cache-timeout-test');
    fireEvent.change(input, {
      target: { value: '-1', name: 'cache_timeout' },
    });
    expect(onInputChange).toHaveBeenCalled();
  });

  test('chart cache timeout rejects values less than -1', () => {
    renderComponent();
    const performanceHeader = screen.getByText(t('Performance'));
    fireEvent.click(performanceHeader);
    const input = screen.getByTestId('cache-timeout-test');
    fireEvent.change(input, {
      target: { value: '-5', name: 'cache_timeout' },
    });
    expect(onInputChange).not.toHaveBeenCalled();
  });

  test('renders the collaps tab correctly and resets to default tab after closing', () => {
    const { rerender } = renderComponent();
    const sqlLabTab = screen.getByRole('tab', {
      name: /SQL Lab./i,
    });

    expect(sqlLabTab).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(sqlLabTab);
    expect(sqlLabTab).toHaveAttribute('aria-expanded', 'true');
    const customDb = {
      ...defaultDb,
      expose_in_sqllab: false,
    };

    rerender(
      <ExtraOptions
        db={customDb as unknown as DatabaseObject}
        onInputChange={onInputChange}
        onTextChange={onTextChange}
        onEditorChange={onEditorChange}
        onExtraInputChange={onExtraInputChange}
        onExtraEditorChange={onExtraEditorChange}
        extraExtension={undefined}
      />,
    );
    expect(sqlLabTab).toHaveAttribute('aria-expanded', 'false');
  });

  test('all collapse panels should expand when clicking anywhere on the header', () => {
    renderComponent();
    const allPanelTabs = screen.getAllByRole('tab');
    expect(allPanelTabs.length).toBeGreaterThanOrEqual(4); // At least 4 main panels

    allPanelTabs.forEach(panelTab => {
      // Initially should be collapsed
      expect(panelTab).toHaveAttribute('aria-expanded', 'false');
      // Click on the panel tab (entire header should be clickable)
      fireEvent.click(panelTab);
      expect(panelTab).toHaveAttribute('aria-expanded', 'true');
      fireEvent.click(panelTab);
      // Panel should collapse back
      expect(panelTab).toHaveAttribute('aria-expanded', 'false');
    });
  });
});

const maskedDb = {
  ...defaultDb,
  id: 3,
  masked_encrypted_extra: JSON.stringify({
    connect_args: { jwt: 'XXXXXXXXXX', password: 'XXXXXXXXXX', host: 'h' },
  }),
  engine_information: {
    ...defaultDb.engine_information,
    encrypted_extra_sensitive_fields: {
      '$.connect_args.jwt': 'JWT Token',
      '$.connect_args.password': 'Password',
      '$.oauth2_client_info.secret': 'OAuth2 client secret',
    },
  },
};

const renderSecurityPanel = (db: object, hintChars: number) => {
  render(
    <ExtraOptions
      db={db as unknown as DatabaseObject}
      onInputChange={jest.fn()}
      onTextChange={jest.fn()}
      onEditorChange={jest.fn()}
      onExtraInputChange={jest.fn()}
      onExtraEditorChange={jest.fn()}
      extraExtension={undefined}
    />,
    {
      useRedux: true,
      initialState: {
        common: { conf: { ENCRYPTED_EXTRA_HINT_CHARS: hintChars } },
      },
    },
  );
  fireEvent.click(screen.getByText(t('Security')));
};

const expectNoSecretFields = () => {
  expect(screen.getByText(t('Secure extra'))).toBeInTheDocument();
  expect(screen.queryByTestId('secure-extra-hints')).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Show' }),
  ).not.toBeInTheDocument();
};

test('secret fields render in edit mode for each masked declared path', () => {
  renderSecurityPanel(maskedDb, 5);
  const blocks = screen.getAllByTestId('secure-extra-hint');
  expect(blocks).toHaveLength(2);
  expect(blocks[0]).toHaveTextContent('JWT Token');
  expect(blocks[0]).toHaveTextContent('Stored at connect_args.jwt.');
  expect(blocks[1]).toHaveTextContent('Password');
  expect(blocks[1]).toHaveTextContent('Stored at connect_args.password.');
  expect(screen.getAllByRole('button', { name: 'Show' })).toHaveLength(2);
  expect(screen.queryByText('OAuth2 client secret')).not.toBeInTheDocument();
});

test('secret fields are absent when the config is 0', () => {
  renderSecurityPanel(maskedDb, 0);
  expectNoSecretFields();
});

test('secret fields are absent in create mode', () => {
  renderSecurityPanel({ ...maskedDb, id: undefined }, 5);
  expectNoSecretFields();
});

test('secret fields are absent when the secure extra has no mask', () => {
  renderSecurityPanel(
    {
      ...maskedDb,
      masked_encrypted_extra: JSON.stringify({ connect_args: { jwt: 'x' } }),
    },
    5,
  );
  expectNoSecretFields();
});

test('secret fields are absent when no declared path holds the mask', () => {
  renderSecurityPanel(
    {
      ...maskedDb,
      masked_encrypted_extra: JSON.stringify({ other: { jwt: 'XXXXXXXXXX' } }),
    },
    5,
  );
  expectNoSecretFields();
});

test('secret fields are absent when the engine declares no sensitive fields', () => {
  renderSecurityPanel(
    { ...maskedDb, engine_information: defaultDb.engine_information },
    5,
  );
  expectNoSecretFields();
});

test('secret fields are absent when the secure extra is invalid JSON', () => {
  renderSecurityPanel(
    { ...maskedDb, masked_encrypted_extra: '{"connect_args": "XXXXXXXXXX"' },
    5,
  );
  expectNoSecretFields();
});

test('the too short note uses four times the configured hint length', async () => {
  fetchMock.get('glob:*/api/v1/database/3/encrypted_extra_hints/', {
    result: [
      {
        path: '$.connect_args.jwt',
        label: 'JWT Token',
        suffix: null,
      },
    ],
  });
  renderSecurityPanel(maskedDb, 5);

  fireEvent.click(screen.getAllByRole('button', { name: 'Show' })[0]);
  const note = await screen.findByText('Too short to show safely');
  fireEvent.mouseEnter(note);

  expect(await screen.findByRole('tooltip')).toHaveTextContent(
    'Only the ending of secrets with at least 20 characters is shown.',
  );
  fetchMock.clearHistory().removeRoutes();
});

const HINTS_ENDPOINT = 'glob:*/api/v1/database/3/encrypted_extra_hints/';
const SECRET_HINTS = {
  result: [
    { path: '$.connect_args.jwt', label: 'JWT Token', suffix: 'Ab3dE' },
    { path: '$.connect_args.password', label: 'Password', suffix: null },
  ],
};

const secretProps = {
  onInputChange: jest.fn(),
  onTextChange: jest.fn(),
  onEditorChange: jest.fn(),
  onExtraInputChange: jest.fn(),
  onExtraEditorChange: jest.fn(),
  extraExtension: undefined,
};

// Renders the Security panel of `maskedDb` with its JWT field revealed.
const renderRevealedJwt = async () => {
  fetchMock.get(HINTS_ENDPOINT, SECRET_HINTS);
  const view = render(
    <ExtraOptions
      {...secretProps}
      db={maskedDb as unknown as DatabaseObject}
      secretsGeneration={0}
    />,
    {
      useRedux: true,
      initialState: { common: { conf: { ENCRYPTED_EXTRA_HINT_CHARS: 5 } } },
    },
  );
  fireEvent.click(screen.getByText(t('Security')));
  fireEvent.click(screen.getAllByRole('button', { name: 'Show' })[0]);
  const input = await screen.findByDisplayValue(/Ab3dE$/);
  return { ...view, input };
};

const withSecureExtra = (maskedEncryptedExtra: string) =>
  ({
    ...maskedDb,
    masked_encrypted_extra: maskedEncryptedExtra,
  }) as unknown as DatabaseObject;

test('a transiently invalid secure extra keeps the revealed secret fields mounted', async () => {
  try {
    const { rerender, input } = await renderRevealedJwt();
    const valid = maskedDb.masked_encrypted_extra;

    rerender(
      <ExtraOptions
        {...secretProps}
        db={withSecureExtra(valid.slice(0, -1))}
        secretsGeneration={0}
      />,
    );
    expect(screen.getAllByTestId('secure-extra-hint')).toHaveLength(2);
    expect(screen.getByDisplayValue(/Ab3dE$/)).toBe(input);

    rerender(
      <ExtraOptions
        {...secretProps}
        db={withSecureExtra(valid)}
        secretsGeneration={0}
      />,
    );
    expect(screen.getByDisplayValue(/Ab3dE$/)).toBe(input);
    expect(fetchMock.callHistory.calls(HINTS_ENDPOINT)).toHaveLength(1);
  } finally {
    fetchMock.clearHistory().removeRoutes();
  }
});

test('removing the mask from a valid secure extra still hides its field', async () => {
  try {
    const { rerender } = await renderRevealedJwt();

    rerender(
      <ExtraOptions
        {...secretProps}
        db={withSecureExtra(
          JSON.stringify({
            connect_args: { jwt: 'a-new-token', password: 'XXXXXXXXXX' },
          }),
        )}
        secretsGeneration={0}
      />,
    );

    const fields = screen.getAllByTestId('secure-extra-hint');
    expect(fields).toHaveLength(1);
    expect(fields[0]).toHaveTextContent('Password');
  } finally {
    fetchMock.clearHistory().removeRoutes();
  }
});

test('a new secrets generation remounts the fields, so their endings are fetched again', async () => {
  try {
    const { rerender } = await renderRevealedJwt();

    rerender(
      <ExtraOptions
        {...secretProps}
        db={maskedDb as unknown as DatabaseObject}
        secretsGeneration={1}
      />,
    );

    expect(screen.queryByDisplayValue(/Ab3dE$/)).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Show' })[0]);
    expect(await screen.findByDisplayValue(/Ab3dE$/)).toBeInTheDocument();
    expect(fetchMock.callHistory.calls(HINTS_ENDPOINT)).toHaveLength(2);
  } finally {
    fetchMock.clearHistory().removeRoutes();
  }
});

const expiringDb = {
  ...maskedDb,
  engine_information: {
    ...maskedDb.engine_information,
    encrypted_extra_expirations: {
      '$.connect_args.password': {
        expires_at: '2026-11-10T13:00:00+00:00',
        expired: false,
      },
      '$.connect_args.jwt': {
        expires_at: '2026-11-03T12:00:00+00:00',
        expired: true,
      },
    },
  },
};

test('the secure extra note lists each stored token that expired or expires soon, with a severity icon', () => {
  // Noon UTC on Nov 5, 2026 is 07:00 in the jest timezone.
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-11-05T12:00:00Z'));
  try {
    // The note does not depend on the reveal being enabled.
    renderSecurityPanel(expiringDb, 0);

    const notes = screen.getAllByTestId('secure-extra-expiry-note');
    expect(notes.map(note => note.textContent)).toEqual([
      'The stored JWT Token expired on Nov 3, 2026.',
      'The stored Password expires in 5 days (Nov 10, 2026).',
    ]);
    const [expiredNote, expiringNote] = notes;
    expect(
      screen.getByText('The stored JWT Token expired on Nov 3, 2026.'),
    ).toHaveClass('ant-typography-danger');
    expect(within(expiredNote).getByTestId('exclamation-circle')).toHaveStyle({
      color: supersetTheme.colorError,
    });
    const expiringText = screen.getByText(
      'The stored Password expires in 5 days (Nov 10, 2026).',
    );
    expect(expiringText).toHaveClass('ant-typography');
    [
      'ant-typography-secondary',
      'ant-typography-warning',
      'ant-typography-danger',
    ].forEach(type => expect(expiringText).not.toHaveClass(type));
    const expiringIcon = within(expiringNote).getByTestId('exclamation-circle');
    expect(expiringIcon).toHaveStyle({ color: supersetTheme.colorWarning });
    expect(expiringIcon).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByText(/click Finish/)).not.toBeInTheDocument();
  } finally {
    jest.useRealTimers();
  }
});

test('the secure extra note is absent without expirations', () => {
  renderSecurityPanel(maskedDb, 5);

  expect(screen.getByText(t('Secure extra'))).toBeInTheDocument();
  expect(
    screen.queryByTestId('secure-extra-expiry-note'),
  ).not.toBeInTheDocument();
});

const focusProps = {
  db: maskedDb as unknown as DatabaseObject,
  onInputChange: jest.fn(),
  onTextChange: jest.fn(),
  onEditorChange: jest.fn(),
  onExtraInputChange: jest.fn(),
  onExtraEditorChange: jest.fn(),
  extraExtension: undefined,
};

type Layout = {
  // Each takes the milliseconds since the mock was set up (fake clock).
  editorTop?: (elapsed: number) => number;
  scrollHeight?: (elapsed: number) => number;
  // The scroll container's box, read by the correction pass.
  containerBox?: { top: number; bottom: number };
};

const EDITOR_HEIGHT = 200;

const isSecureExtra = (element: Element) =>
  element.querySelector(':scope > .control-label')?.textContent ===
  t('Secure extra');

// Replaces scrollIntoView, which jsdom lacks, and reports the given layout for
// the Secure extra container and the scroll container; other elements keep
// jsdom's rect.
const mockScrolling = (layout: Layout = {}) => {
  const startedAt = Date.now();
  const elapsed = () => Date.now() - startedAt;
  const scrollIntoView = jest.fn();
  const originalScroll = Element.prototype.scrollIntoView;
  Element.prototype.scrollIntoView = scrollIntoView;
  const originalRect = Element.prototype.getBoundingClientRect;
  const rect = jest
    .spyOn(Element.prototype, 'getBoundingClientRect')
    .mockImplementation(function mockRect(this: Element) {
      if (layout.editorTop && isSecureExtra(this)) {
        return new DOMRect(0, layout.editorTop(elapsed()), 100, EDITOR_HEIGHT);
      }
      if (
        layout.containerBox &&
        this.getAttribute('data-test') === 'scroller'
      ) {
        const { top, bottom } = layout.containerBox;
        return new DOMRect(0, top, 100, bottom - top);
      }
      return originalRect.call(this);
    });
  const scrollHeight = jest
    .spyOn(Element.prototype, 'scrollHeight', 'get')
    .mockImplementation(function mockHeight(this: Element) {
      return layout.scrollHeight &&
        this.getAttribute('data-test') === 'scroller'
        ? layout.scrollHeight(elapsed())
        : 0;
    });
  return {
    scrollIntoView,
    restore: () => {
      Element.prototype.scrollIntoView = originalScroll;
      rect.mockRestore();
      scrollHeight.mockRestore();
    },
  };
};

// Renders the options inside a scrolling container, as the modal body is.
const renderFocused = () =>
  render(
    <div data-test="scroller" style={{ overflowY: 'auto' }}>
      <ExtraOptions {...focusProps} focusSecureExtra={1} />
    </div>,
    { useRedux: true },
  );

const FRAME_MS = 16;
const advance = (ms: number) =>
  act(() => {
    jest.advanceTimersByTime(ms);
  });
const SMOOTH = { block: 'center', behavior: 'smooth' };

test('a request to focus Secure extra expands the Security panel and scrolls to the editor', async () => {
  const { scrollIntoView, restore } = mockScrolling();
  try {
    const { rerender } = render(
      <ExtraOptions {...focusProps} focusSecureExtra={0} />,
      { useRedux: true },
    );
    expect(screen.queryByText(t('Secure extra'))).not.toBeInTheDocument();

    rerender(<ExtraOptions {...focusProps} focusSecureExtra={1} />);

    expect(await screen.findByText(t('Secure extra'))).toBeInTheDocument();
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledWith(SMOOTH), {
      timeout: 2000,
    });
    expect(scrollIntoView.mock.contexts[0]).toHaveTextContent(
      t('Secure extra'),
    );
  } finally {
    restore();
  }
});

test('the scroll to Secure extra waits for the opening panel to stop growing', () => {
  jest.useFakeTimers();
  // 722 for 5 frames, then the panel grows to 1100 over 3 frames.
  const { scrollIntoView, restore } = mockScrolling({
    editorTop: () => 500,
    scrollHeight: elapsed =>
      Math.min(
        1100,
        722 + Math.max(0, Math.floor(elapsed / FRAME_MS) - 5) * 126,
      ),
  });
  try {
    renderFocused();

    advance(384);
    expect(scrollIntoView).not.toHaveBeenCalled();

    advance(48);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenCalledWith(SMOOTH);
  } finally {
    restore();
    jest.useRealTimers();
  }
});

test('the scroll to Secure extra waits for a late tab animation to finish', () => {
  jest.useFakeTimers();
  // Moves by 301 px at about 390 ms, after the minimum wait has nearly run.
  const { scrollIntoView, restore } = mockScrolling({
    editorTop: elapsed => (elapsed < 390 ? 801 : 500),
    scrollHeight: elapsed => (elapsed < 400 ? 722 : 1100),
  });
  try {
    renderFocused();

    advance(432);
    expect(scrollIntoView).not.toHaveBeenCalled();

    advance(64);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenCalledWith(SMOOTH);
  } finally {
    restore();
    jest.useRealTimers();
  }
});

test('the scroll to Secure extra waits the minimum time even when nothing moves', () => {
  jest.useFakeTimers();
  const { scrollIntoView, restore } = mockScrolling({
    editorTop: () => 500,
    scrollHeight: () => 1100,
  });
  try {
    renderFocused();

    advance(FRAME_MS * 4);
    expect(scrollIntoView).not.toHaveBeenCalled();
    advance(384 - FRAME_MS * 4);
    expect(scrollIntoView).not.toHaveBeenCalled();

    advance(32);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenCalledWith(SMOOTH);
  } finally {
    restore();
    jest.useRealTimers();
  }
});

test('the scroll to Secure extra still happens at the limit when the layout never settles', () => {
  jest.useFakeTimers();
  const { scrollIntoView, restore } = mockScrolling({
    editorTop: elapsed => 900 - elapsed,
    scrollHeight: () => 1100,
  });
  try {
    renderFocused();

    advance(1184);
    expect(scrollIntoView).not.toHaveBeenCalled();

    advance(32);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenCalledWith(SMOOTH);
  } finally {
    restore();
    jest.useRealTimers();
  }
});

test('a scroll that leaves the editor below the container is corrected once', () => {
  jest.useFakeTimers();
  // The editor stays at 600 to 800, below a container box that ends at 500.
  const { scrollIntoView, restore } = mockScrolling({
    editorTop: () => 600,
    scrollHeight: () => 1100,
    containerBox: { top: 0, bottom: 500 },
  });
  try {
    renderFocused();
    advance(432);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);

    advance(600);

    expect(scrollIntoView).toHaveBeenCalledTimes(2);
    expect(scrollIntoView).toHaveBeenLastCalledWith({
      block: 'center',
      behavior: 'auto',
    });
    advance(2000);
    expect(scrollIntoView).toHaveBeenCalledTimes(2);
  } finally {
    restore();
    jest.useRealTimers();
  }
});

test('a scroll that brings the editor into the container is not corrected', () => {
  jest.useFakeTimers();
  const { scrollIntoView, restore } = mockScrolling({
    editorTop: () => 100,
    scrollHeight: () => 1100,
    containerBox: { top: 0, bottom: 500 },
  });
  try {
    renderFocused();
    advance(432);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);

    advance(2000);

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  } finally {
    restore();
    jest.useRealTimers();
  }
});

test('a pending scroll to Secure extra is dropped on unmount', () => {
  jest.useFakeTimers();
  const { scrollIntoView, restore } = mockScrolling({
    editorTop: () => 500,
    scrollHeight: () => 1100,
  });
  try {
    const { unmount } = renderFocused();
    advance(200);

    unmount();
    advance(3000);

    expect(scrollIntoView).not.toHaveBeenCalled();
  } finally {
    restore();
    jest.useRealTimers();
  }
});

test('opening Security re-measures the Secure extra editor on the next frame', () => {
  jest.useFakeTimers();
  mockSecureExtraEditor.resize.mockClear();
  try {
    renderSecurityPanel(maskedDb, 5);
    expect(screen.getByTestId('secure-extra-editor')).toBeInTheDocument();
    expect(mockSecureExtraEditor.resize).not.toHaveBeenCalled();

    advance(FRAME_MS);
    expect(mockSecureExtraEditor.resize).toHaveBeenCalledTimes(1);
    expect(mockSecureExtraEditor.resize).toHaveBeenCalledWith(true);

    advance(20 * FRAME_MS);
    expect(mockSecureExtraEditor.resize).toHaveBeenCalledTimes(1);
  } finally {
    jest.useRealTimers();
  }
});

test('a request to focus Secure extra re-measures the editor once it opens and again after the scroll', () => {
  jest.useFakeTimers();
  mockSecureExtraEditor.resize.mockClear();
  const { scrollIntoView, restore } = mockScrolling({
    editorTop: () => 500,
    scrollHeight: () => 1100,
  });
  try {
    renderFocused();

    advance(3 * FRAME_MS);
    expect(mockSecureExtraEditor.resize).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).not.toHaveBeenCalled();

    advance(432);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(mockSecureExtraEditor.resize).toHaveBeenCalledTimes(2);
    expect(mockSecureExtraEditor.resize).toHaveBeenLastCalledWith(true);
  } finally {
    restore();
    jest.useRealTimers();
  }
});

test('closing the options before the next frame never re-measures the editor', () => {
  jest.useFakeTimers();
  mockSecureExtraEditor.resize.mockClear();
  try {
    const { unmount } = render(<ExtraOptions {...focusProps} />, {
      useRedux: true,
    });
    fireEvent.click(screen.getByText(t('Security')));

    unmount();
    advance(20 * FRAME_MS);

    expect(mockSecureExtraEditor.resize).not.toHaveBeenCalled();
  } finally {
    jest.useRealTimers();
  }
});

test('a pane mounted without a focus request never opens or scrolls until a new request arrives', () => {
  jest.useFakeTimers();
  const onSecureExtraFocused = jest.fn();
  const { scrollIntoView, restore } = mockScrolling({
    editorTop: () => 100,
    scrollHeight: () => 1100,
    containerBox: { top: 0, bottom: 500 },
  });
  const focused = (request: number) => (
    <div data-test="scroller" style={{ overflowY: 'auto' }}>
      <ExtraOptions
        {...focusProps}
        focusSecureExtra={request}
        onSecureExtraFocused={onSecureExtraFocused}
      />
    </div>
  );
  try {
    const { rerender } = render(focused(0), { useRedux: true });
    advance(2000);
    expect(screen.queryByText(t('Secure extra'))).not.toBeInTheDocument();
    expect(scrollIntoView).not.toHaveBeenCalled();

    rerender(focused(4));
    expect(screen.getByText(t('Secure extra'))).toBeInTheDocument();
    advance(432);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(onSecureExtraFocused).not.toHaveBeenCalled();

    // Handled once the correction check has run.
    advance(600);
    expect(onSecureExtraFocused).toHaveBeenCalledTimes(1);

    // The parent then withdraws the request; Security stays open.
    rerender(focused(0));
    advance(2000);
    expect(screen.getByText(t('Secure extra'))).toBeInTheDocument();
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(onSecureExtraFocused).toHaveBeenCalledTimes(1);
  } finally {
    restore();
    jest.useRealTimers();
  }
});

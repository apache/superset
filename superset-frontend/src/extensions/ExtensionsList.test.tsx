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
import userEvent from '@testing-library/user-event';
import { fireEvent, render, screen, waitFor, within } from 'spec/helpers/testing-library';
import { SupersetClient } from '@superset-ui/core';
import ExtensionsList from './ExtensionsList';

// ---------------------------------------------------------------------------
// Module-level mocks
// ---------------------------------------------------------------------------

jest.mock('src/views/CRUD/hooks', () => ({
  useListViewResource: jest.fn(),
}));

jest.mock('src/components', () => ({
  ListView: ({ columns, data }: any) => (
    <table>
      <tbody>
        {(data ?? []).map((row: any) =>
          columns.map((col: any) => (
            <td key={`${row.id}-${col.id}`}>
              {col.Cell ? col.Cell({ row: { original: row } }) : row[col.accessor]}
            </td>
          )),
        )}
      </tbody>
    </table>
  ),
}));

// Stub SubMenu so tests aren't coupled to the navigation menu rendering chain.
jest.mock('src/features/home/SubMenu', () => ({
  __esModule: true,
  default: ({ buttons }: any) => (
    <div data-test="submenu">
      {(buttons ?? []).map((btn: any, i: number) => (
        // eslint-disable-next-line react/no-array-index-key
        <button key={i} type="button" onClick={btn.onClick}>
          {btn.name}
        </button>
      ))}
    </div>
  ),
}));

// withToasts is the outermost HOC — pass through so callers can inject toast fns.
jest.mock('src/components/MessageToasts/withToasts', () => (C: any) => C);


jest.mock('src/core/views', () => ({
  getRegisteredViewIds: jest.fn(() => []),
  subscribeToLocation: jest.fn(() => () => undefined),
}));

jest.mock('src/core/extensions', () => ({
  notifyExtensionSettingsChanged: jest.fn(),
}));

jest.mock('@superset-ui/core', () => {
  const actual = jest.requireActual('@superset-ui/core');
  return {
    ...actual,
    SupersetClient: {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
    },
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const { useListViewResource } = jest.requireMock('src/views/CRUD/hooks');
const mockGet = SupersetClient.get as jest.Mock;
const mockPost = SupersetClient.post as jest.Mock;
const mockPut = SupersetClient.put as jest.Mock;
const mockDelete = SupersetClient.delete as jest.Mock;

const EXTENSIONS = [
  { id: 'acme.chatbot', name: 'chatbot', publisher: 'acme', enabled: true },
  { id: 'acme.widget', name: 'widget', publisher: 'acme', enabled: true },
];

const mockFetchData = jest.fn();
const mockRefreshData = jest.fn();

function setupHook(extensions = EXTENSIONS) {
  useListViewResource.mockReturnValue({
    state: {
      loading: false,
      resourceCount: extensions.length,
      resourceCollection: extensions,
    },
    fetchData: mockFetchData,
    refreshData: mockRefreshData,
  });
}

const defaultProps = {
  addDangerToast: jest.fn(),
  addSuccessToast: jest.fn(),
};

function renderList(props = {}) {
  return render(<ExtensionsList {...defaultProps} {...props} />, {
    useRedux: true,
    useQueryParams: true,
    useRouter: true,
    useTheme: true,
  });
}

function uploadFile(input: HTMLInputElement, file: File) {
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  fireEvent.change(input);
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  mockGet.mockResolvedValue({ json: { result: { active_chatbot_id: null } } });
  setupHook();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('renders the import button in the submenu', () => {
  renderList();
  // SubMenu stub renders each button's `name` node — the button wraps the icon tooltip
  expect(screen.getByTestId('submenu')).toBeInTheDocument();
});

test('renders extension names in the table', async () => {
  renderList();
  await waitFor(() => {
    expect(screen.getByText('chatbot')).toBeInTheDocument();
    expect(screen.getByText('widget')).toBeInTheDocument();
  });
});

test('renders a delete button for each extension', async () => {
  renderList();
  await waitFor(() => {
    expect(screen.getAllByTestId('delete-extension')).toHaveLength(
      EXTENSIONS.length,
    );
  });
});

test('clicking delete opens confirmation dialog', async () => {
  renderList();
  await waitFor(() => screen.getByText('chatbot'));

  await userEvent.click(screen.getAllByTestId('delete-extension')[0]);

  await waitFor(() => {
    expect(screen.getByText(/are you sure you want to delete/i)).toBeInTheDocument();
  });
});

test('typing DELETE in confirmation modal triggers delete API call', async () => {
  mockDelete.mockResolvedValue({});
  renderList();
  await waitFor(() => screen.getByText('chatbot'));

  await userEvent.click(screen.getAllByTestId('delete-extension')[0]);

  const confirmInput = await screen.findByTestId('delete-modal-input');
  fireEvent.change(confirmInput, { target: { value: 'DELETE' } });

  // The DeleteModal confirm button is labelled "Delete" and sits in a dialog.
  const modal = screen.getByRole('dialog');
  const confirmBtn = within(modal)
    .getAllByRole('button', { name: /^delete$/i })
    .pop()!;
  await userEvent.click(confirmBtn);

  await waitFor(() => {
    expect(mockDelete).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: '/api/v1/extensions/acme/chatbot' }),
    );
    expect(mockRefreshData).toHaveBeenCalled();
  });
});

test('star button shown only for extensions registered as chatbot views', async () => {
  const { getRegisteredViewIds } = jest.requireMock('src/core/views');
  (getRegisteredViewIds as jest.Mock).mockReturnValue(['acme.chatbot']);

  renderList();
  await waitFor(() => screen.getByText('chatbot'));

  // Only acme.chatbot is a chatbot — only one star button should appear
  expect(screen.getAllByTestId('set-default-chatbot')).toHaveLength(1);
});

test('clicking star calls PUT settings with the extension id', async () => {
  const { getRegisteredViewIds } = jest.requireMock('src/core/views');
  (getRegisteredViewIds as jest.Mock).mockReturnValue(['acme.chatbot']);
  mockPut.mockResolvedValue({ json: {} });

  renderList();
  await waitFor(() => screen.getByText('chatbot'));

  await userEvent.click(screen.getByTestId('set-default-chatbot'));

  await waitFor(() => {
    expect(mockPut).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: '/api/v1/extensions/settings',
        jsonPayload: { active_chatbot_id: 'acme.chatbot' },
      }),
    );
  });
});

test('pressing Enter on star span triggers set-default action', async () => {
  const { getRegisteredViewIds } = jest.requireMock('src/core/views');
  (getRegisteredViewIds as jest.Mock).mockReturnValue(['acme.chatbot']);
  mockPut.mockResolvedValue({ json: {} });

  renderList();
  await waitFor(() => screen.getByText('chatbot'));

  fireEvent.keyDown(screen.getByTestId('set-default-chatbot'), { key: 'Enter' });

  await waitFor(() => {
    expect(mockPut).toHaveBeenCalled();
  });
});

test('uploading a non-.supx file shows danger toast without calling API', async () => {
  const addDangerToast = jest.fn();
  renderList({ addDangerToast });

  const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
  uploadFile(input, new File(['x'], 'evil.zip', { type: 'application/zip' }));

  expect(addDangerToast).toHaveBeenCalledWith(
    expect.stringMatching(/\.supx/i),
  );
  expect(mockPost).not.toHaveBeenCalled();
});

test('uploading a .supx file calls POST endpoint and refreshes list', async () => {
  mockPost.mockResolvedValue({});
  renderList();

  const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
  uploadFile(input, new File(['PK'], 'my.supx', { type: 'application/octet-stream' }));

  await waitFor(() => {
    expect(mockPost).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: '/api/v1/extensions/' }),
    );
    expect(mockRefreshData).toHaveBeenCalled();
  });
});

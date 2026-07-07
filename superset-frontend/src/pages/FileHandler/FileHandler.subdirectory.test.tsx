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
import { ComponentType } from 'react';
import { Route, Router } from 'react-router-dom';
import { createMemoryHistory, MemoryHistory } from 'history';
import {
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import FileHandler from './index';

// Subdirectory regression for the five `history.push('/welcome/')` emitters
// in FileHandler. The sibling `index.test.tsx` mocks `useHistory` and so can
// only assert the value the emitter passes to `push`; this module wires up
// the real react-router pathway (real `<Router>` + a `createMemoryHistory`
// the test owns) and asserts that the resulting `history.location.pathname`
// resolves to `/welcome/` regardless of whether the user arrived under the
// root deployment (`/file-handler`) or a `/superset` subdirectory deployment
// (`/superset/file-handler`).
//
// Note on basename composition: Superset's dependency tree pairs
// `react-router-dom@5.3.4` with `history@5.3.0`, but the `basename` prop on
// `<BrowserRouter>` is silently dropped in that combination (history v5 has
// no basename support; react-router-dom v5 was designed for history v4). The
// production subdirectory deployment composes the prefix at the URL-emitting
// layer via `applicationRoot()` in non-router callers (see
// `SliceHeaderControls.subdirectory.test.tsx`), and the in-app router relies
// on the unprefixed routes matching whatever path the user arrived at. As a
// result, asserting `history.createHref(...)` here would not exercise any
// real composition — so this module pins only what is meaningful in this
// stack: that the emitter pushes the unprefixed route and the post-push
// location reflects it.

const mockAddDangerToast = jest.fn();
const mockAddSuccessToast = jest.fn();

jest.setTimeout(60000);

type ToastInjectedProps = {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
};

jest.mock('src/components/MessageToasts/withToasts', () => ({
  __esModule: true,
  default: (Component: ComponentType<ToastInjectedProps>) =>
    function MockedWithToasts(props: Record<string, unknown>) {
      return (
        <Component
          {...props}
          addDangerToast={mockAddDangerToast}
          addSuccessToast={mockAddSuccessToast}
        />
      );
    },
}));

interface UploadDataModalProps {
  show: boolean;
  onHide: () => void;
  type: string;
  allowedExtensions: string[];
  fileListOverride?: File[];
}

jest.mock('src/features/databases/UploadDataModel', () => ({
  __esModule: true,
  default: ({
    show,
    onHide,
    type,
    allowedExtensions,
    fileListOverride,
  }: UploadDataModalProps) => (
    <div data-test="upload-modal">
      <div data-test="modal-show">{show.toString()}</div>
      <div data-test="modal-type">{type}</div>
      <div data-test="modal-extensions">{allowedExtensions.join(',')}</div>
      <div data-test="modal-file">{fileListOverride?.[0]?.name ?? ''}</div>
      <button onClick={onHide} type="button">
        Close
      </button>
    </div>
  ),
}));

// NOTE: deliberately NO jest.mock('react-router-dom', ...) here — this module
// exists precisely to exercise the real useHistory() pathway, not a mock.

type MockFileHandle = {
  kind: 'file';
  name: string;
  getFile: () => Promise<File>;
  isSameEntry: () => Promise<boolean>;
  queryPermission: () => Promise<PermissionState>;
  requestPermission: () => Promise<PermissionState>;
};

const createMockFileHandle = (
  fileName: string,
  opts: { throwOnGetFile?: boolean } = {},
): MockFileHandle => ({
  kind: 'file',
  name: fileName,
  getFile: opts.throwOnGetFile
    ? async () => {
        throw new Error('File access denied');
      }
    : async () => new File(['test'], fileName),
  isSameEntry: async () => false,
  queryPermission: async () => 'granted',
  requestPermission: async () => 'granted',
});

type LaunchQueue = {
  setConsumer: (
    consumer: (params: { files?: MockFileHandle[] }) => void,
  ) => void;
};

const pendingTimerIds = new Set<ReturnType<typeof setTimeout>>();
const MAX_CONSUMER_POLL_ATTEMPTS = 50;

// Mirrors `setupLaunchQueue` in index.test.tsx: defer the consumer to a
// macrotask so it doesn't fire synchronously inside the component's useEffect
// (the MessageChannel mock in jsDomWithFetchAPI forces React to schedule via
// setTimeout, and inline consumer calls deadlock Jest).
const setupLaunchQueue = (fileHandle: MockFileHandle | null = null) => {
  let savedConsumer:
    ((params: { files?: MockFileHandle[] }) => void | Promise<void>) | null =
    null;
  (window as unknown as Window & { launchQueue: LaunchQueue }).launchQueue = {
    setConsumer: (consumer: (params: { files?: MockFileHandle[] }) => void) => {
      savedConsumer = consumer;
      if (fileHandle) {
        const id = setTimeout(() => {
          pendingTimerIds.delete(id);
          consumer({ files: [fileHandle] });
        }, 0);
        pendingTimerIds.add(id);
      }
    },
  };
  return {
    triggerConsumer: async (params: { files?: MockFileHandle[] }) => {
      let attempts = 0;
      while (!savedConsumer && attempts < MAX_CONSUMER_POLL_ATTEMPTS) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise(resolve => {
          setTimeout(resolve, 0);
        });
        attempts += 1;
      }
      if (!savedConsumer) {
        throw new Error(
          `LaunchQueue consumer was never registered after ${MAX_CONSUMER_POLL_ATTEMPTS} polling attempts`,
        );
      }
      await savedConsumer(params);
    },
  };
};

type DeploymentLabel = 'root' | 'subdir';

const ENTRY_PATHS: Record<DeploymentLabel, string> = {
  root: '/file-handler',
  subdir: '/superset/file-handler',
};

const renderUnderEntry = (entryPath: string): MemoryHistory => {
  const history = createMemoryHistory({ initialEntries: [entryPath] });
  render(
    <Router history={history}>
      <Route path={entryPath}>
        <FileHandler />
      </Route>
    </Router>,
    { useRedux: true },
  );
  return history;
};

const expectNavigatedToWelcome = async (
  history: MemoryHistory,
): Promise<void> => {
  await waitFor(() => {
    expect(history.location.pathname).toBe('/welcome/');
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  delete (window as unknown as Window & { launchQueue?: LaunchQueue })
    .launchQueue;
});

afterEach(() => {
  pendingTimerIds.forEach(id => clearTimeout(id));
  pendingTimerIds.clear();
  delete (window as unknown as Window & { launchQueue?: LaunchQueue })
    .launchQueue;
});

// Run each redirect scenario under both deployment shapes. Both must end at
// `/welcome/`; the test fails if a future maintainer re-introduces the
// `/superset/` prefix into the emitter at any of the five call sites.
const DEPLOYMENTS: DeploymentLabel[] = ['root', 'subdir'];

DEPLOYMENTS.forEach(label => {
  const entryPath = ENTRY_PATHS[label];

  test(`launchQueue unsupported → /welcome/ under ${label} (${entryPath})`, async () => {
    const history = renderUnderEntry(entryPath);
    await expectNavigatedToWelcome(history);
  });

  test(`no files provided → /welcome/ under ${label} (${entryPath})`, async () => {
    const { triggerConsumer } = setupLaunchQueue();
    const history = renderUnderEntry(entryPath);
    await triggerConsumer({ files: [] });
    await expectNavigatedToWelcome(history);
  });

  test(`unsupported file type → /welcome/ under ${label} (${entryPath})`, async () => {
    const { triggerConsumer } = setupLaunchQueue();
    const history = renderUnderEntry(entryPath);
    await triggerConsumer({ files: [createMockFileHandle('test.pdf')] });
    await expectNavigatedToWelcome(history);
  });

  test(`getFile() error → /welcome/ under ${label} (${entryPath})`, async () => {
    const { triggerConsumer } = setupLaunchQueue();
    const history = renderUnderEntry(entryPath);
    await triggerConsumer({
      files: [createMockFileHandle('test.csv', { throwOnGetFile: true })],
    });
    await expectNavigatedToWelcome(history);
  });

  test(`modal close → /welcome/ under ${label} (${entryPath})`, async () => {
    setupLaunchQueue(createMockFileHandle('test.csv'));
    const history = renderUnderEntry(entryPath);
    const modal = await screen.findByTestId('upload-modal');
    expect(modal).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    await expectNavigatedToWelcome(history);
  });
});

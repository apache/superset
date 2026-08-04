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
import { act, renderHook, waitFor } from '@testing-library/react';
import {
  createChartFromSnapshot,
  fetchActivity,
  fetchVersionSnapshot,
  restoreVersion,
} from './api';
import { useVersionActions } from './useVersionActions';

jest.mock('./api', () => ({
  createChartFromSnapshot: jest.fn(),
  createDashboardFromSnapshot: jest.fn(),
  fetchActivity: jest.fn(),
  fetchVersionSnapshot: jest.fn(),
  restoreVersion: jest.fn(),
}));

const mockToasts = {
  addSuccessToast: jest.fn(),
  addInfoToast: jest.fn(),
  addWarningToast: jest.fn(),
  addDangerToast: jest.fn(),
};
jest.mock('src/components/MessageToasts/withToasts', () => ({
  useToasts: () => mockToasts,
}));

const mockNavigateOpenedTab = jest.fn();
const mockCloseOpenedTab = jest.fn();
const mockOpenBlankTab = jest.fn();
jest.mock('src/utils/navigationUtils', () => ({
  openBlankTab: () => mockOpenBlankTab(),
  navigateOpenedTab: (tab: unknown, path: string) =>
    mockNavigateOpenedTab(tab, path),
  closeOpenedTab: (tab: unknown) => mockCloseOpenedTab(tab),
}));

jest.mock('./RestoreConfirmModal', () => ({
  __esModule: true,
  default: () => null,
}));

const mockDispatch = jest.fn();
// The hook reads the page's dirty signal itself (so no call site can forget
// it); tests control that signal through this state object.
let mockState: {
  versionHistory: { sessionLog: unknown[] };
  dashboardState: { hasUnsavedChanges: boolean };
};
jest.mock('react-redux', () => ({
  ...jest.requireActual('react-redux'),
  useDispatch: () => mockDispatch,
  useSelector: (selector: (state: unknown) => unknown) => selector(mockState),
}));

const target = {
  versionUuid: 'v-1',
  headline: 'Some change',
  issuedAt: '2026-07-01T00:00:00Z',
};

/** Drives a restore to completion and returns the hook result. */
const restoreOnce = async (entity: 'chart' | 'dashboard' = 'dashboard') => {
  const { result } = renderHook(() => useVersionActions(entity, 'entity-uuid'));
  act(() => {
    result.current.requestRestore(target);
  });
  return result;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockState = {
    versionHistory: { sessionLog: [] },
    dashboardState: { hasUnsavedChanges: false },
  };
  // Distinct ids so the "already at this version" branch is not taken.
  // mockReset first: clearAllMocks does NOT drop queued ...Once values, so
  // without it every beforeEach stacks another tx-1 and a test that doesn't
  // consume its pair silently shifts the queue for every test after it.
  (fetchActivity as jest.Mock)
    .mockReset()
    .mockResolvedValueOnce({ result: [{ transaction_id: 1 }] })
    .mockResolvedValue({ result: [{ transaction_id: 2 }] });
  (restoreVersion as jest.Mock).mockResolvedValue({ message: 'OK' });
  mockOpenBlankTab.mockReturnValue({ closed: false });
});

test('a dirty dashboard blocks restore with the save-or-discard toast', () => {
  // Restoring rehydrates the page from the server, wiping unsaved edits and
  // undo history — the same hazard the preview entry gate guards.
  mockState.dashboardState.hasUnsavedChanges = true;
  const { result } = renderHook(() =>
    useVersionActions('dashboard', 'entity-uuid'),
  );

  act(() => {
    result.current.requestRestore(target);
  });

  expect(mockToasts.addDangerToast).toHaveBeenCalledWith(
    expect.stringContaining('Save or discard'),
  );
  // The confirmation modal never opens, so no restore can proceed.
  expect(result.current.restoreModal?.props.target).toBeNull();
});

test('work turning dirty while the modal is open still blocks the restore', async () => {
  // The request-time gate can be outrun: an in-flight edit resolving after
  // the confirmation modal opened makes the page dirty. Confirm must
  // re-check at the moment of mutation, not trust the gate that ran earlier.
  const { result, rerender } = renderHook(() =>
    useVersionActions('dashboard', 'entity-uuid'),
  );
  act(() => {
    result.current.requestRestore(target);
  });
  expect(result.current.restoreModal?.props.target).toEqual(target);

  mockState.dashboardState.hasUnsavedChanges = true;
  rerender();
  await act(async () => {
    await result.current.restoreModal?.props.onConfirm();
  });

  expect(restoreVersion).not.toHaveBeenCalled();
  expect(mockToasts.addDangerToast).toHaveBeenCalledWith(
    expect.stringContaining('Save or discard'),
  );
  expect(result.current.restoreModal?.props.target).toBeNull();
});

test('a pending confirmation is dropped when the page entity changes', () => {
  // An in-place slice swap changes the uuid under an open modal; confirming
  // would combine the new entity with the old version uuid.
  const { result, rerender } = renderHook(
    ({ uuid }: { uuid: string }) => useVersionActions('chart', uuid),
    { initialProps: { uuid: 'entity-uuid' } },
  );
  act(() => {
    result.current.requestRestore(target);
  });
  expect(result.current.restoreModal?.props.target).toEqual(target);

  rerender({ uuid: 'another-entity-uuid' });

  expect(result.current.restoreModal?.props.target).toBeNull();
});

test('unsaved explore control changes block restore the same way', () => {
  // Explore's dirty signal is the session log — the list the panel itself
  // presents as unsaved changes under "Current version".
  mockState.versionHistory.sessionLog = [{ label: "Changed 'Metrics'" }];
  const { result } = renderHook(() =>
    useVersionActions('chart', 'entity-uuid'),
  );

  act(() => {
    result.current.requestRestore(target);
  });

  expect(mockToasts.addDangerToast).toHaveBeenCalledWith(
    expect.stringContaining('Save or discard'),
  );
  expect(result.current.restoreModal?.props.target).toBeNull();
});

test('surfaces the partial-restore message rather than reporting plain success', async () => {
  // The endpoint answers 200 with the shortfall in the message body, so a
  // client that ignores it tells the user their dashboard came back whole.
  (restoreVersion as jest.Mock).mockResolvedValue({
    message:
      'OK; 2 chart(s) referenced by the snapshot no longer exist and were not reattached',
  });
  const result = await restoreOnce();

  await act(async () => {
    await result.current.restoreModal?.props.onConfirm();
  });

  await waitFor(() => {
    expect(mockToasts.addWarningToast).toHaveBeenCalledWith(
      expect.stringContaining('no longer exist'),
    );
  });
});

test('stays quiet about shortfalls when the restore was complete', async () => {
  const result = await restoreOnce();

  await act(async () => {
    await result.current.restoreModal?.props.onConfirm();
  });

  await waitFor(() => {
    expect(mockToasts.addSuccessToast).toHaveBeenCalled();
  });
  expect(mockToasts.addWarningToast).not.toHaveBeenCalled();
});

test('includes the server reason when a restore fails', async () => {
  (restoreVersion as jest.Mock).mockRejectedValue(
    new Response(JSON.stringify({ message: 'Dashboard is read only' }), {
      status: 422,
    }),
  );
  const result = await restoreOnce();

  await act(async () => {
    await result.current.restoreModal?.props.onConfirm();
  });

  await waitFor(() => {
    expect(mockToasts.addDangerToast).toHaveBeenCalled();
  });
  // A 403 and a 422 must not read identically to the user.
  expect(mockToasts.addDangerToast.mock.calls[0][0]).toContain('read only');
});

test('claims the tab before awaiting so the fork is not popup-blocked', async () => {
  (fetchVersionSnapshot as jest.Mock).mockResolvedValue({
    slice_name: 'A chart',
  });
  (createChartFromSnapshot as jest.Mock).mockResolvedValue(7);
  const { result } = renderHook(() =>
    useVersionActions('chart', 'entity-uuid'),
  );

  let pending: unknown;
  act(() => {
    pending = result.current.openAsNew(target);
  });
  // Synchronously, in the same task as the activation — before either
  // request has resolved.
  expect(mockOpenBlankTab).toHaveBeenCalledTimes(1);

  await act(async () => {
    await pending;
  });
  expect(mockNavigateOpenedTab).toHaveBeenCalledWith(
    expect.anything(),
    '/explore/?slice_id=7',
  );
});

test('closes the claimed tab when the fork fails', async () => {
  (fetchVersionSnapshot as jest.Mock).mockRejectedValue(new Error('nope'));
  const { result } = renderHook(() =>
    useVersionActions('chart', 'entity-uuid'),
  );

  await act(async () => {
    await result.current.openAsNew(target);
  });

  // The claimed tab specifically — a call with null would mean the tab was
  // never claimed up front, which is the bug this guards.
  expect(mockCloseOpenedTab).toHaveBeenCalledWith(
    expect.objectContaining({ closed: false }),
  );
  expect(mockNavigateOpenedTab).not.toHaveBeenCalled();
  expect(mockToasts.addDangerToast).toHaveBeenCalled();
});

test('a second activation in the same tick does not fork twice', async () => {
  (fetchVersionSnapshot as jest.Mock).mockResolvedValue({
    slice_name: 'A chart',
  });
  (createChartFromSnapshot as jest.Mock).mockResolvedValue(7);
  const { result } = renderHook(() =>
    useVersionActions('chart', 'entity-uuid'),
  );

  // Both calls read the same render's isCreating; only a synchronous lock
  // (not state) stops the second.
  await act(async () => {
    await Promise.all([
      result.current.openAsNew(target),
      result.current.openAsNew(target),
    ]);
  });

  expect(createChartFromSnapshot).toHaveBeenCalledTimes(1);
  expect(mockOpenBlankTab).toHaveBeenCalledTimes(1);
});

test('activations from two hook instances do not fork twice', async () => {
  // The preview banner and the history panel each mount their own
  // useVersionActions for the same entity. A per-instance (ref) lock lets
  // the banner's "Open as new" and the panel kebab's slip past each other
  // and create two copies; the lock must be entity-wide.
  let resolveSnapshot: (value: { slice_name: string }) => void = () => {};
  (fetchVersionSnapshot as jest.Mock).mockReturnValue(
    new Promise(resolve => {
      resolveSnapshot = resolve;
    }),
  );
  (createChartFromSnapshot as jest.Mock).mockResolvedValue(7);
  const banner = renderHook(() => useVersionActions('chart', 'entity-uuid'));
  const panel = renderHook(() => useVersionActions('chart', 'entity-uuid'));

  await act(async () => {
    const first = banner.result.current.openAsNew(target);
    const second = panel.result.current.openAsNew(target);
    resolveSnapshot({ slice_name: 'A chart' });
    await Promise.all([first, second]);
  });

  expect(fetchVersionSnapshot).toHaveBeenCalledTimes(1);
  expect(createChartFromSnapshot).toHaveBeenCalledTimes(1);

  // The lock is self-cleaning: once settled, a fresh fork goes through.
  (fetchVersionSnapshot as jest.Mock).mockResolvedValue({
    slice_name: 'A chart',
  });
  await act(async () => {
    await panel.result.current.openAsNew(target);
  });
  expect(createChartFromSnapshot).toHaveBeenCalledTimes(2);
});

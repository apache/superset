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
import { logging } from '@apache-superset/core/utils';
import { store } from 'src/views/store';
import { ToastMeta, ToastType } from 'src/components/MessageToasts/types';
import { toasts } from './index';

const state = (): ToastMeta[] => store.getState().messageToasts;

test.each([
  ['addInfoToast', ToastType.Info],
  ['addSuccessToast', ToastType.Success],
  ['addWarningToast', ToastType.Warning],
  ['addDangerToast', ToastType.Danger],
] as const)(
  '%s adds a toast of the matching type and returns its id',
  (fn, toastType) => {
    const id = toasts[fn]('Sent');
    expect(state()).toContainEqual(
      expect.objectContaining({ id, text: 'Sent', toastType }),
    );
  },
);

test('link becomes an action that opens the url in a new tab', () => {
  const open = jest.spyOn(window, 'open').mockImplementation(() => null);
  const id = toasts.addSuccessToast('Sent', {
    link: { href: 'https://docs.google.com/x', label: 'Open' },
  });
  const toast = state().find(t => t.id === id)!;
  expect(toast.action?.label).toBe('Open');
  toast.action!.onClick();
  expect(open).toHaveBeenCalledWith(
    'https://docs.google.com/x',
    '_blank',
    'noopener noreferrer',
  );
  open.mockRestore();
});

test('a link that fails the navigation guard is refused and logged', () => {
  const open = jest.spyOn(window, 'open').mockImplementation(() => null);
  const error = jest.spyOn(logging, 'error').mockImplementation(() => {});
  const id = toasts.addSuccessToast('Sent', {
    link: { href: 'https://user:secret@example.com/x', label: 'Open' },
  });
  const toast = state().find(t => t.id === id)!;
  expect(() => toast.action!.onClick()).not.toThrow();
  expect(open).not.toHaveBeenCalled();
  expect(error).toHaveBeenCalled();
  open.mockRestore();
  error.mockRestore();
});

test('a javascript: link is never opened as a script url', () => {
  const open = jest.spyOn(window, 'open').mockImplementation(() => null);
  const id = toasts.addSuccessToast('Sent', {
    link: { href: ['javascript', 'alert(1)'].join(':'), label: 'Open' },
  });
  const toast = state().find(t => t.id === id)!;
  expect(() => toast.action!.onClick()).not.toThrow();
  open.mock.calls.forEach(([url]) => {
    expect(String(url)).not.toMatch(/^javascript:/i);
  });
  open.mockRestore();
});

test('duration defaults to 8000 and accepts 0', () => {
  const a = toasts.addInfoToast('a');
  const b = toasts.addInfoToast('b', { duration: 0 });
  expect(state().find(t => t.id === a)!.duration).toBe(8000);
  expect(state().find(t => t.id === b)!.duration).toBe(0);
});

test('removeToast removes the toast', () => {
  const id = toasts.addDangerToast('x');
  toasts.removeToast(id);
  expect(state().find(t => t.id === id)).toBeUndefined();
});

test('text is not rendered as html, even if extra options are passed', () => {
  const id = toasts.addInfoToast('<b>x</b>', { allowHtml: true } as never);
  expect(state().find(t => t.id === id)!.allowHtml).toBe(false);
});

test('non-string text renders as its string form', () => {
  const id = toasts.addDangerToast(new Error('boom') as unknown as string);
  expect(state().find(t => t.id === id)!.text).toBe('Error: boom');
});

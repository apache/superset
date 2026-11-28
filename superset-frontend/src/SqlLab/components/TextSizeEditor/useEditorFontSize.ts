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
import { useCallback, useSyncExternalStore } from 'react';
import {
  getItem,
  LocalStorageKeys,
  setItem,
} from 'src/utils/localStorageHelpers';
import {
  clampEditorFontSize,
  DEFAULT_EDITOR_FONT_SIZE,
  EDITOR_FONT_SIZE_STEP,
} from 'src/SqlLab/constants';

// Every open SQL Lab tab renders its own editor, so the font size is shared
// through a tiny store backed by localStorage rather than per-component state.
const listeners = new Set<() => void>();

const readFontSize = (): number => {
  const stored = getItem(
    LocalStorageKeys.SqllabEditorFontSize,
    DEFAULT_EDITOR_FONT_SIZE,
  );
  return typeof stored === 'number' && Number.isFinite(stored)
    ? clampEditorFontSize(stored)
    : DEFAULT_EDITOR_FONT_SIZE;
};

const writeFontSize = (fontSize: number): void => {
  setItem(LocalStorageKeys.SqllabEditorFontSize, clampEditorFontSize(fontSize));
  listeners.forEach(listener => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export default function useEditorFontSize() {
  const fontSize = useSyncExternalStore(subscribe, readFontSize);

  const increase = useCallback(
    () => writeFontSize(readFontSize() + EDITOR_FONT_SIZE_STEP),
    [],
  );
  const decrease = useCallback(
    () => writeFontSize(readFontSize() - EDITOR_FONT_SIZE_STEP),
    [],
  );
  const reset = useCallback(() => writeFontSize(DEFAULT_EDITOR_FONT_SIZE), []);

  return { fontSize, increase, decrease, reset };
}

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
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

const URL_PARAM = 'version_uuid';

interface VersionHistoryContextValue {
  isPanelOpen: boolean;
  previewVersionUuid: string | null;
  openPanel: () => void;
  closePanel: () => void;
  enterPreview: (versionUuid: string) => void;
  exitPreview: () => void;
}

const VersionHistoryContext = createContext<VersionHistoryContextValue | null>(
  null,
);

function readInitialPreview(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get(URL_PARAM);
  } catch {
    return null;
  }
}

function writeUrlParam(versionUuid: string | null) {
  if (typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    if (versionUuid) {
      url.searchParams.set(URL_PARAM, versionUuid);
    } else {
      url.searchParams.delete(URL_PARAM);
    }
    window.history.replaceState(window.history.state, '', url.toString());
  } catch {
    // ignore
  }
}

interface ProviderProps {
  children: ReactNode;
}

export function VersionHistoryProvider({ children }: ProviderProps) {
  const initialPreview = useMemo(() => readInitialPreview(), []);
  const [isPanelOpen, setIsPanelOpen] = useState<boolean>(!!initialPreview);
  const [previewVersionUuid, setPreviewVersionUuid] = useState<string | null>(
    initialPreview,
  );

  const openPanel = useCallback(() => setIsPanelOpen(true), []);
  const closePanel = useCallback(() => {
    setIsPanelOpen(false);
  }, []);

  const enterPreview = useCallback((versionUuid: string) => {
    setPreviewVersionUuid(versionUuid);
  }, []);

  const exitPreview = useCallback(() => {
    setPreviewVersionUuid(null);
  }, []);

  // Reflect preview state in the URL so users can bookmark / share a
  // pinned historical version.
  useEffect(() => {
    writeUrlParam(previewVersionUuid);
  }, [previewVersionUuid]);

  const value = useMemo(
    () => ({
      isPanelOpen,
      previewVersionUuid,
      openPanel,
      closePanel,
      enterPreview,
      exitPreview,
    }),
    [
      isPanelOpen,
      previewVersionUuid,
      openPanel,
      closePanel,
      enterPreview,
      exitPreview,
    ],
  );

  return (
    <VersionHistoryContext.Provider value={value}>
      {children}
    </VersionHistoryContext.Provider>
  );
}

export function useVersionHistory(): VersionHistoryContextValue {
  const ctx = useContext(VersionHistoryContext);
  if (!ctx) {
    // Allows the menu item / panel to short-circuit gracefully when the
    // provider hasn't mounted (e.g. feature flag off).
    return {
      isPanelOpen: false,
      previewVersionUuid: null,
      openPanel: () => undefined,
      closePanel: () => undefined,
      enterPreview: () => undefined,
      exitPreview: () => undefined,
    };
  }
  return ctx;
}

export function useOptionalVersionHistory(): VersionHistoryContextValue | null {
  return useContext(VersionHistoryContext);
}

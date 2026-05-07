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
import { getClientErrorObject, t } from '@superset-ui/core';
import { useEffect, useRef, useCallback, useState } from 'react';
import { useHistory } from 'react-router-dom';

type UseUnsavedChangesPromptProps = {
  hasUnsavedChanges: boolean;
  onSave: () => Promise<void> | void;
  isSaveModalVisible?: boolean;
  manualSaveOnUnsavedChanges?: boolean;
};

export const useUnsavedChangesPrompt = ({
  hasUnsavedChanges,
  onSave,
  isSaveModalVisible = false,
  manualSaveOnUnsavedChanges = false,
}: UseUnsavedChangesPromptProps) => {
  const history = useHistory();
  const [showModal, setShowModal] = useState(false);

  const confirmNavigationRef = useRef<(() => void) | null>(null);
  const unblockRef = useRef<() => void>(() => {});
  const manualSaveRef = useRef(false); // Track if save was user-initiated (not via navigation)

  const handleConfirmNavigation = useCallback(() => {
    setShowModal(false);
    confirmNavigationRef.current?.();
  }, []);

  const handleSaveAndCloseModal = useCallback(async () => {
    try {
      if (manualSaveOnUnsavedChanges) manualSaveRef.current = true;

      await onSave();
      setShowModal(false);
    } catch (err) {
      const clientError = await getClientErrorObject(err);
      throw new Error(
        clientError.message ||
          clientError.error ||
          t('Sorry, an error occurred'),
        { cause: err },
      );
    }
  }, [manualSaveOnUnsavedChanges, onSave]);

  const triggerManualSave = useCallback(() => {
    manualSaveRef.current = true;
    onSave();
  }, [onSave]);

  const blockCallback = useCallback(
    ({ pathname, state }: { pathname: string; state?: any }) => {
      if (manualSaveRef.current) {
        manualSaveRef.current = false;
        return undefined;
      }

      confirmNavigationRef.current = () => {
        unblockRef.current?.();
        history.push(pathname, state);
      };

      setShowModal(true);
      return false;
    },
    [history],
  );

  useEffect(() => {
    if (!hasUnsavedChanges) return undefined;

    const unblock = history.block(blockCallback);
    unblockRef.current = unblock;

    return () => unblock();
  }, [blockCallback, hasUnsavedChanges, history]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return;
      event.preventDefault();

      // Most browsers require a "returnValue" set to empty string
      const evt = event as any;
      evt.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    if (!isSaveModalVisible && manualSaveRef.current) {
      setShowModal(false);
      manualSaveRef.current = false;
    }
  }, [isSaveModalVisible]);

  return {
    showModal,
    setShowModal,
    handleConfirmNavigation,
    handleSaveAndCloseModal,
    triggerManualSave,
  };
};

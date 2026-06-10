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
import { t } from '@apache-superset/core/translation';
import { getClientErrorObject } from '@superset-ui/core';
import {
  useEffect,
  useRef,
  useCallback,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { useBlocker } from '@tanstack/react-router';
import { useBeforeUnload } from 'src/hooks/useBeforeUnload';

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
  const [showModal, setShowModalState] = useState(false);
  const showModalRef = useRef(showModal);
  showModalRef.current = showModal;

  const manualSaveRef = useRef(false); // Track if save was user-initiated (not via navigation)

  const blocker = useBlocker({
    shouldBlockFn: ({ action }) => {
      // REPLACE actions are URL sync (e.g. updating form_data_key), not navigation
      if (action === 'REPLACE') {
        return false;
      }

      if (manualSaveRef.current) {
        manualSaveRef.current = false;
        return false;
      }

      return true;
    },
    withResolver: true,
    disabled: !hasUnsavedChanges,
    // the manual useBeforeUnload listener below handles the unload prompt
    enableBeforeUnload: false,
  });
  const blockerRef = useRef(blocker);
  blockerRef.current = blocker;

  useEffect(() => {
    if (blocker.status === 'blocked') {
      setShowModalState(true);
    }
  }, [blocker.status]);

  // Closing the modal without navigating discards the blocked navigation
  const setShowModal: Dispatch<SetStateAction<boolean>> = useCallback(value => {
    const next =
      typeof value === 'function' ? value(showModalRef.current) : value;
    if (!next) {
      blockerRef.current.reset?.();
    }
    setShowModalState(next);
  }, []);

  const handleConfirmNavigation = useCallback(() => {
    setShowModalState(false);
    blockerRef.current.proceed?.();
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
  }, [manualSaveOnUnsavedChanges, onSave, setShowModal]);

  const triggerManualSave = useCallback(() => {
    manualSaveRef.current = true;
    onSave();
  }, [onSave]);

  useEffect(() => {
    if (!isSaveModalVisible && manualSaveRef.current) {
      setShowModal(false);
      manualSaveRef.current = false;
    }
  }, [isSaveModalVisible, setShowModal]);

  useBeforeUnload(hasUnsavedChanges);

  return {
    showModal,
    setShowModal,
    handleConfirmNavigation,
    handleSaveAndCloseModal,
    triggerManualSave,
  };
};

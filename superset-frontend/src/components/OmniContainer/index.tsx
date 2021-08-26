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

import React, { useRef, useState } from 'react';
import { styled, t } from '@superset-ui/core';
import { isFeatureEnabled, FeatureFlag } from 'src/featureFlags';
import Modal from 'src/components/Modal';
import { useComponentDidMount } from 'src/common/hooks/useComponentDidMount';
import { logEvent } from 'src/logger/actions';
import { Omnibar } from './Omnibar';
import { LOG_ACTIONS_OMNIBAR_TRIGGERED } from '../../logger/LogUtils';
import { getDashboards } from './getDashboards';

const OmniModal = styled(Modal)`
  margin-top: 20%;

  .ant-modal-body {
    padding: 0;
    overflow: visible;
  }
`;

export default function OmniContainer() {
  const showOmni = useRef<boolean>();
  const modalRef = useRef<HTMLDivElement>(null);
  const [showModal, setShowModal] = useState(false);
  const handleLogEvent = (show: boolean) =>
    logEvent(LOG_ACTIONS_OMNIBAR_TRIGGERED, {
      show_omni: show,
    });
  const handleClose = () => {
    showOmni.current = false;
    setShowModal(false);
    handleLogEvent(false);
  };

  useComponentDidMount(() => {
    showOmni.current = false;

    function handleKeydown(event: KeyboardEvent) {
      if (!isFeatureEnabled(FeatureFlag.OMNIBAR)) return;
      const controlOrCommand = event.ctrlKey || event.metaKey;
      const isOk = ['KeyK'].includes(event.code);
      const isEsc = event.key === 'Escape';

      if (isEsc && showOmni.current) {
        handleClose();
        return;
      }
      if (controlOrCommand && isOk) {
        showOmni.current = !showOmni.current;
        setShowModal(showOmni.current);
        handleLogEvent(!!showOmni.current);
      }
    }

    function handleClickOutside(event: MouseEvent) {
      if (
        modalRef.current &&
        !modalRef.current.contains(event.target as Node)
      ) {
        handleClose();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeydown);
    return () => {
      document.removeEventListener('keydown', handleKeydown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  });

  return (
    <OmniModal
      title=""
      show={showModal}
      hideFooter
      closable={false}
      onHide={() => {}}
      destroyOnClose
    >
      <div ref={modalRef}>
        <Omnibar
          id="InputOmnibar"
          placeholder={t('Search all dashboards')}
          extensions={[getDashboards]}
        />
      </div>
    </OmniModal>
  );
}

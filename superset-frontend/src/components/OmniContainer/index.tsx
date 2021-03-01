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
import { styled } from '@superset-ui/core';
import { isFeatureEnabled, FeatureFlag } from 'src/featureFlags';
import Modal from 'src/common/components/Modal';
import { useComponentDidMount } from 'src/common/hooks/useComponentDidMount';
import { Omnibar } from './Omnibar';
import { LOG_ACTIONS_OMNIBAR_TRIGGERED } from '../../logger/LogUtils';
import { getDashboards } from './getDashboards';

const OmniModal = styled(Modal)`
  margin-top: 20%;

  .ant-modal-body {
    padding: 0;
  }
`;

interface Props {
  logEvent: (log: string, object: object) => void;
}

export default function OmniContainer({ logEvent }: Props) {
  const showOmni = useRef<boolean>();
  const [showModal, setShowModal] = useState(false);

  useComponentDidMount(() => {
    showOmni.current = false;
    function handleKeydown(event: KeyboardEvent) {
      if (!isFeatureEnabled(FeatureFlag.OMNIBAR)) return;
      const controlOrCommand = event.ctrlKey || event.metaKey;
      const isOk = ['KeyK', 'KeyS'].includes(event.code); // valid keys "s" or "k"
      if (controlOrCommand && isOk) {
        logEvent(LOG_ACTIONS_OMNIBAR_TRIGGERED, {
          show_omni: !!showOmni.current,
        });
        showOmni.current = !showOmni.current;
        setShowModal(showOmni.current);
        if (showOmni.current) {
          document.getElementById('InputOmnibar')?.focus();
        }
      }
    }

    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  });

  return (
    <OmniModal
      title=""
      show={showModal}
      hideFooter
      closable={false}
      onHide={() => {}}
    >
      <Omnibar
        id="InputOmnibar"
        placeholder="Search all dashboards"
        extensions={[getDashboards]}
      />
    </OmniModal>
  );
}

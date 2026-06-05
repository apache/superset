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
import React, { useEffect, useState } from 'react';
import { Bubble } from './components/Bubble';
import { Panel } from './components/Panel';
import { ExtensionErrorBoundary } from './components/ErrorBoundary';
import { isOpen, setOpen, subscribe } from './state';

/**
 * Root extension component. Mirrors module-state into React via `subscribe`.
 *
 * Unlike the Reference Chatbot, Alt registers no `core.chatbot__*` commands
 * (those ids are globally owned by Reference), so the bubble↔panel transition
 * drives the local open-state directly via `setOpen`.
 */
export const ReferenceChatbot: React.FC = () => {
  const [open, setOpenState] = useState<boolean>(isOpen());

  useEffect(() => subscribe(setOpenState), []);

  return (
    <ExtensionErrorBoundary>
      {open ? (
        <Panel onClose={() => setOpen(false)} />
      ) : (
        <Bubble onClick={() => setOpen(true)} />
      )}
    </ExtensionErrorBoundary>
  );
};

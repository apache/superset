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
import { commands } from '@apache-superset/core';
import { isOpen, setOpen } from './state';

interface DisposableLike {
  dispose(): void;
}

/**
 * Registers the three chatbot intent commands and returns their disposables.
 *
 * TODO(P4): if/when the host pre-registers `core.chatbot__*` as host-owned
 * intents that extensions implement instead of own, swap registerCommand for
 * the implementation hook. The command ids stay the same so call sites do not
 * change.
 */
export const registerChatbotCommands = (): DisposableLike[] => [
  commands.registerCommand(
    { id: 'core.chatbot__open', title: 'Open chatbot' },
    () => setOpen(true),
  ),
  commands.registerCommand(
    { id: 'core.chatbot__close', title: 'Close chatbot' },
    () => setOpen(false),
  ),
  commands.registerCommand(
    { id: 'core.chatbot__toggle', title: 'Toggle chatbot' },
    () => setOpen(!isOpen()),
  ),
];

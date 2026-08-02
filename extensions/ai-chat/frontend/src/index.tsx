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
/**
 * Extension entry point, evaluated by the host once the module federation
 * container loads. Registration is a module-level side effect because the
 * extension framework has no activate/deactivate lifecycle.
 */
import { chat, translation } from '@apache-superset/core';
import ChatPanel from './components/ChatPanel';
import ChatTrigger from './components/ChatTrigger';

const { t } = translation;

chat.registerChat(
  {
    id: 'enx-dev.ai-chat',
    name: t('Superset AI Chat Assistant'),
    description: t(
      'AI assistant for finding, understanding and managing dashboards, ' +
        'charts, datasets and SQL.',
    ),
  },
  ChatTrigger,
  ChatPanel,
);

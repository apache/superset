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
import { useEffect, useState } from 'react';
import { translation } from '@apache-superset/core';
import { ChatApiError, fetchChatConfig } from '../api/client';
import type { AiChatConfig } from '../types';

const { t } = translation;

export type ConfigState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; config: AiChatConfig };

/**
 * Fetches gateway availability once per mount. The gateway is the only
 * authority on whether the assistant is usable, so the panel renders from
 * this state instead of assuming a configuration.
 */
export function useChatConfig(): ConfigState {
  const [state, setState] = useState<ConfigState>({ status: 'loading' });
  useEffect(() => {
    let cancelled = false;
    fetchChatConfig()
      .then(config => {
        if (!cancelled) setState({ status: 'ready', config });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            status: 'error',
            message:
              error instanceof ChatApiError
                ? error.message
                : t('The AI chat service could not be reached.'),
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return state;
}

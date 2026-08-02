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
import React from 'react';
import { Alert } from 'antd';
import { theme, translation } from '@apache-superset/core';
import type { ConfigState } from '../hooks/useChatConfig';

const { t } = translation;
const { useTheme } = theme;

interface ChatStatusAlertsProps {
  configState: ConfigState;
}

/**
 * Explains why the assistant is unusable, when it is. One condition holds at
 * a time: the gateway is unreachable, the feature is disabled, or the
 * provider is incomplete. Each is fixed by an operator, so the copy names the
 * setting to change.
 */
export default function ChatStatusAlerts({
  configState,
}: ChatStatusAlertsProps) {
  const theme = useTheme();

  const alert = (() => {
    if (configState.status === 'error') {
      return { type: 'warning' as const, title: configState.message };
    }
    if (configState.status !== 'ready') return null;
    if (!configState.config.enabled) {
      return {
        type: 'info' as const,
        testId: 'chat-disabled-alert',
        title: t(
          'The AI assistant is not enabled on this instance. An ' +
            'administrator can enable it via AI_CHAT_CONFIG in ' +
            'superset_config.py.',
        ),
      };
    }
    if (!configState.config.provider_configured) {
      return {
        type: 'warning' as const,
        testId: 'chat-misconfigured-alert',
        title: t(
          'The AI provider is not fully configured. An administrator ' +
            'must complete AI_CHAT_CONFIG (provider, model and API key ' +
            'environment variable).',
        ),
      };
    }
    return null;
  })();

  if (!alert) return null;

  return (
    <Alert
      type={alert.type}
      showIcon
      // The core Alert wrapper supplies these, but it still passes antd's
      // deprecated `message` prop, so they are set here instead.
      role="alert"
      aria-live="polite"
      style={{ margin: theme.marginXS }}
      data-test={alert.testId}
      title={alert.title}
    />
  );
}

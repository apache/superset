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
import { Button, Flex, Typography } from 'antd';
import { RobotOutlined } from '@ant-design/icons';
import { theme, translation } from '@apache-superset/core';
import type { Page } from '../types';

const { t } = translation;
const { useTheme } = theme;

function suggestionsFor(page: Page): string[] {
  const base = [
    t('What can you help me do in Superset?'),
    t('Find dashboards related to revenue.'),
    t('Find a dataset suitable for customer-retention analysis.'),
    t('Create a chart from an existing dataset.'),
  ];
  if (page === 'dashboard') {
    return [
      t('Explain how this dashboard is structured.'),
      t('Which datasets does this dashboard use?'),
      t('Suggest improvements for this dashboard.'),
      ...base.slice(0, 2),
    ];
  }
  if (page === 'sqllab') {
    return [
      t('Help me write a query against one of my datasets.'),
      t('Explain the difference between a virtual and physical dataset.'),
      ...base.slice(0, 2),
    ];
  }
  return base;
}

interface WelcomeStateProps {
  page: Page;
  disabled: boolean;
  onPick: (suggestion: string) => void;
}

export default function WelcomeState({
  page,
  disabled,
  onPick,
}: WelcomeStateProps) {
  const theme = useTheme();
  return (
    <Flex
      data-test="chat-welcome"
      vertical
      align="center"
      justify="center"
      gap={theme.marginXS}
      style={{ flex: 1, padding: theme.padding, textAlign: 'center' }}
    >
      <RobotOutlined aria-hidden style={{ fontSize: 32 }} />
      <Typography.Title level={5} style={{ margin: 0 }}>
        {t('Superset AI Assistant')}
      </Typography.Title>
      <Typography.Text type="secondary">
        {t(
          'Ask about your dashboards, charts, datasets and SQL — or try one ' +
            'of these:',
        )}
      </Typography.Text>
      <Flex
        vertical
        gap={theme.marginXS}
        style={{ width: '100%', maxWidth: 320, marginTop: theme.marginXS }}
      >
        {suggestionsFor(page).map(suggestion => (
          <Button
            key={suggestion}
            size="small"
            disabled={disabled}
            onClick={() => onPick(suggestion)}
            // Labels can exceed the panel width, and antd buttons do not wrap
            // by default, so the text spills outside the button frame
            style={{ whiteSpace: 'normal', height: 'auto' }}
          >
            {suggestion}
          </Button>
        ))}
      </Flex>
    </Flex>
  );
}

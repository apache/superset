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
import { Tag } from 'antd';
import {
  BarChartOutlined,
  DashboardOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';
import { theme, translation } from '@apache-superset/core';
import { entityHref } from '../utils/entityRef';
import type { ResourceContext } from '../types';

const { t } = translation;
const { useTheme } = theme;

const REFERENCE_ICON: Record<ResourceContext['kind'], React.ReactNode> = {
  dashboard: <DashboardOutlined />,
  chart: <BarChartOutlined />,
  dataset: <DatabaseOutlined />,
};

export function referenceLabel(reference: ResourceContext): string {
  const kind: Record<ResourceContext['kind'], string> = {
    dashboard: t('Dashboard'),
    chart: t('Chart'),
    dataset: t('Dataset'),
  };
  // Until the name resolves, the id is what identifies it.
  return reference.name || `${kind[reference.kind]} ${reference.id_or_slug}`;
}

interface ReferenceTagProps {
  reference: ResourceContext;
  /** Detaches it; omitted where the tag records what a turn already carried */
  onClose?: () => void;
  /** Turns the whole chip into a link to the object it names */
  linked?: boolean;
  'data-test'?: string;
}

/**
 * One dropped dashboard, chart or dataset, shown the same way wherever it
 * appears: detachable in the composer, and a link above the message it was
 * sent with.
 */
export default function ReferenceTag({
  reference,
  onClose,
  linked,
  'data-test': dataTest,
}: ReferenceTagProps) {
  const theme = useTheme();
  const label = referenceLabel(reference);
  const tag = (
    <Tag
      icon={REFERENCE_ICON[reference.kind]}
      closable={Boolean(onClose)}
      onClose={onClose}
      data-test={dataTest}
      title={label}
      // Same tokens as the host's secondary button, matching the header's
      // scope tag. Set through `style` rather than Tag's `color` prop, which
      // pairs a custom background with white text.
      style={{
        color: theme.buttonSecondaryColor || theme.colorPrimary,
        background: theme.buttonSecondaryBg || theme.colorPrimaryBg,
        borderColor: theme.buttonSecondaryBorderColor || 'transparent',
        maxWidth: 200,
        overflow: 'hidden',
        // Both rows space their tags with a Flex gap
        marginInlineEnd: 0,
      }}
    >
      {label}
    </Tag>
  );
  return linked ? (
    <a
      href={entityHref(reference)}
      aria-label={t('Open %s', label)}
      data-test="chat-reference-link"
    >
      {tag}
    </a>
  ) : (
    tag
  );
}

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

import { useState } from 'react';
import { styled } from '@apache-superset/core/theme';
import { t } from '@apache-superset/core/translation';
import { Popover } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { type TaskPrivateProperties } from './types';

const PayloadContainer = styled.div`
  max-width: 400px;
  max-height: 300px;
  overflow: auto;
  padding: ${({ theme }) => theme.sizeUnit * 2}px;
`;

const PayloadPre = styled.pre`
  margin: 0;
  font-size: ${({ theme }) => theme.fontSizeSM}px;
  white-space: pre-wrap;
  word-wrap: break-word;
`;

// Heading above a section; separates the results payload from the debug-only
// internal section when both are shown.
const SectionLabel = styled.div`
  font-weight: ${({ theme }) => theme.fontWeightStrong};
  color: ${({ theme }) => theme.colorTextSecondary};
  margin: ${({ theme }) => theme.sizeUnit}px 0;

  &:not(:first-child) {
    margin-top: ${({ theme }) => theme.sizeUnit * 3}px;
    border-top: 1px solid ${({ theme }) => theme.colorBorderSecondary};
    padding-top: ${({ theme }) => theme.sizeUnit * 2}px;
  }
`;

const InfoIconWrapper = styled.span`
  cursor: pointer;
  color: ${({ theme }) => theme.colorIcon};

  &:hover {
    color: ${({ theme }) => theme.colorPrimary};
  }
`;

interface TaskPayloadPopoverProps {
  payload: Record<string, unknown>;
  // Internal, debug-only state (present only in debug mode). Rendered as a
  // separate section below the results payload; kept distinct because the
  // payload may get custom renderers while `private` stays a raw dump.
  taskPrivate?: TaskPrivateProperties;
}

const hasContent = (obj?: Record<string, unknown> | null): boolean =>
  !!obj && Object.keys(obj).length > 0;

export default function TaskPayloadPopover({
  payload,
  taskPrivate,
}: TaskPayloadPopoverProps) {
  const [visible, setVisible] = useState(false);

  const hasPayload = hasContent(payload);
  const hasPrivate =
    hasContent(taskPrivate?.framework) ||
    hasContent(taskPrivate?.task) ||
    hasContent(taskPrivate?.subscription);

  const content = (
    <PayloadContainer>
      {hasPayload && (
        <>
          {hasPrivate && <SectionLabel>{t('Results')}</SectionLabel>}
          <PayloadPre>{JSON.stringify(payload, null, 2)}</PayloadPre>
        </>
      )}
      {hasPrivate && (
        <>
          <SectionLabel>{t('Internal')}</SectionLabel>
          <PayloadPre>{JSON.stringify(taskPrivate, null, 2)}</PayloadPre>
        </>
      )}
    </PayloadContainer>
  );

  return (
    <Popover
      content={content}
      trigger="hover"
      placement="leftTop"
      open={visible}
      onOpenChange={setVisible}
    >
      <InfoIconWrapper>
        <Icons.InfoCircleOutlined iconSize="l" />
      </InfoIconWrapper>
    </Popover>
  );
}

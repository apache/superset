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

import { useState, useCallback } from 'react';
import { t } from '@apache-superset/core';
import { styled } from '@apache-superset/core/ui';
import { Popover, Tooltip } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import copyTextToClipboard from 'src/utils/copy';

const StackTraceContainer = styled.div`
  max-width: 600px;
  max-height: 400px;
  display: flex;
  flex-direction: column;
`;

const Header = styled.div`
  display: flex;
  justify-content: flex-end;
  padding: ${({ theme }) => theme.sizeUnit}px
    ${({ theme }) => theme.sizeUnit * 2}px;
  border-bottom: 1px solid ${({ theme }) => theme.colorBorder};
`;

const CopyButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  padding: ${({ theme }) => theme.sizeUnit / 2}px;
  color: ${({ theme }) => theme.colorTextSecondary};
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.sizeUnit / 2}px;
  font-size: ${({ theme }) => theme.fontSizeSM}px;

  &:hover {
    color: ${({ theme }) => theme.colorText};
  }
`;

const StackTraceContent = styled.div`
  overflow: auto;
  padding: ${({ theme }) => theme.sizeUnit * 2}px;
  flex: 1;
`;

const StackTrace = styled.pre`
  margin: 0;
  font-size: ${({ theme }) => theme.fontSizeSM}px;
  white-space: pre-wrap;
  word-wrap: break-word;
  font-family: ${({ theme }) => theme.fontFamilyCode};
`;

const ErrorIconWrapper = styled.span`
  cursor: pointer;
  color: ${({ theme }) => theme.colorError};

  &:hover {
    opacity: 0.8;
  }
`;

interface TaskStackTracePopoverProps {
  stackTrace: string;
}

export default function TaskStackTracePopover({
  stackTrace,
}: TaskStackTracePopoverProps) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const { addDangerToast } = useToasts();

  const handleCopy = useCallback(() => {
    copyTextToClipboard(() => Promise.resolve(stackTrace))
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {
        addDangerToast(t('Failed to copy stack trace to clipboard'));
      });
  }, [stackTrace, addDangerToast]);

  const content = (
    <StackTraceContainer>
      <Header>
        <Tooltip title={copied ? t('Copied!') : t('Copy to clipboard')}>
          <CopyButton onClick={handleCopy}>
            {copied ? (
              <Icons.CheckOutlined iconSize="s" />
            ) : (
              <Icons.CopyOutlined iconSize="s" />
            )}
            {t('Copy')}
          </CopyButton>
        </Tooltip>
      </Header>
      <StackTraceContent>
        <StackTrace>{stackTrace}</StackTrace>
      </StackTraceContent>
    </StackTraceContainer>
  );

  return (
    <Popover
      content={content}
      trigger="hover"
      placement="leftTop"
      visible={visible}
      onVisibleChange={setVisible}
    >
      <ErrorIconWrapper>
        <Icons.BugOutlined iconSize="l" />
      </ErrorIconWrapper>
    </Popover>
  );
}

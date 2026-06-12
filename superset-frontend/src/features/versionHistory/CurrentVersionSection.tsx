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
import { KeyboardEvent, useState } from 'react';
import { t } from '@apache-superset/core/translation';
import { styled } from '@apache-superset/core/theme';
import { extendedDayjs } from '@superset-ui/core/utils/dates';
import { Icons } from '@superset-ui/core/components';
import type { SessionLogEntry } from './types';
import { SHORT_DATETIME_FORMAT } from './display';

const Container = styled.div`
  ${({ theme }) => `
    border-bottom: 1px solid ${theme.colorBorderSecondary};
    padding: ${theme.sizeUnit * 2}px 0 ${theme.sizeUnit * 4}px;
  `}
`;

const Header = styled.div`
  ${({ theme }) => `
    display: flex;
    align-items: center;
    gap: ${theme.sizeUnit * 2}px;
    padding: ${theme.sizeUnit * 3}px 0;
    cursor: pointer;
    &:hover {
      background-color: ${theme.colorBgTextHover};
    }
  `}
`;

const Title = styled.div`
  ${({ theme }) => `
    flex: 1;
    font-size: ${theme.fontSize}px;
    line-height: ${theme.lineHeight};
    color: ${theme.colorText};
  `}
`;

const IconWrapper = styled.span`
  ${({ theme }) => `
    color: ${theme.colorTextSecondary};
    display: flex;
  `}
`;

const EntriesBlock = styled.div`
  ${({ theme }) => `
    background-color: ${theme.colorPrimaryBg};
    border-radius: ${theme.borderRadius}px;
    padding: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 3}px;
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit * 2}px;
  `}
`;

const EntryLabel = styled.div`
  ${({ theme }) => `
    font-size: ${theme.fontSize}px;
    line-height: ${theme.lineHeight};
    color: ${theme.colorText};
  `}
`;

const EntryMeta = styled.div`
  ${({ theme }) => `
    color: ${theme.colorTextQuaternary};
    font-size: ${theme.fontSizeSM}px;
    line-height: ${theme.lineHeightSM};
  `}
`;

export interface CurrentVersionSectionProps {
  entries: SessionLogEntry[];
  /** e.g. "Restored version · Dec 5, 2025, 5:18 PM" */
  restoreNotice: string | null;
}

export default function CurrentVersionSection({
  entries,
  restoreNotice,
}: CurrentVersionSectionProps) {
  const [expanded, setExpanded] = useState(false);

  if (!restoreNotice && entries.length === 0) {
    return null;
  }

  const toggle = () => setExpanded(value => !value);
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggle();
    }
  };

  return (
    <Container data-test="version-history-current-version">
      <Header
        role="button"
        tabIndex={0}
        onClick={toggle}
        onKeyDown={handleKeyDown}
        aria-expanded={expanded}
        aria-label={t('Current version')}
      >
        <IconWrapper>
          <Icons.CheckCircleOutlined iconSize="l" />
        </IconWrapper>
        <Title>{t('Current version')}</Title>
        <IconWrapper>
          {expanded ? (
            <Icons.UpOutlined iconSize="m" />
          ) : (
            <Icons.DownOutlined iconSize="m" />
          )}
        </IconWrapper>
      </Header>
      {expanded && (
        <EntriesBlock>
          {restoreNotice && <EntryLabel>{restoreNotice}</EntryLabel>}
          {entries.map(entry => {
            // Session log timestamps are local epoch milliseconds.
            const time = extendedDayjs(entry.ts).format(SHORT_DATETIME_FORMAT);
            return (
              <div key={`${entry.controlName}-${entry.ts}`}>
                <EntryLabel>{entry.label}</EntryLabel>
                <EntryMeta>
                  {entry.user ? `${entry.user} · ${time}` : time}
                </EntryMeta>
              </div>
            );
          })}
        </EntriesBlock>
      )}
    </Container>
  );
}

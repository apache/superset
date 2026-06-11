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

const Container = styled.div<{ expanded: boolean }>`
  ${({ theme, expanded }) => `
    border-bottom: 1px solid ${theme.colorSplit};
    background-color: ${expanded ? theme.colorSuccessBg : 'transparent'};
  `}
`;

const Header = styled.div`
  ${({ theme }) => `
    display: flex;
    align-items: center;
    gap: ${theme.sizeUnit * 2}px;
    padding: ${theme.sizeUnit * 2}px;
    cursor: pointer;
    &:hover {
      background-color: ${theme.colorBgTextHover};
    }
  `}
`;

const Title = styled.div`
  ${({ theme }) => `
    flex: 1;
    font-size: ${theme.fontSizeSM}px;
    font-weight: ${theme.fontWeightStrong};
  `}
`;

const CaretWrapper = styled.span`
  ${({ theme }) => `
    color: ${theme.colorTextSecondary};
    display: flex;
  `}
`;

const Entry = styled.div`
  ${({ theme }) => `
    display: flex;
    justify-content: space-between;
    gap: ${theme.sizeUnit}px;
    padding: ${theme.sizeUnit}px ${theme.sizeUnit * 2}px
      ${theme.sizeUnit}px ${theme.sizeUnit * 6}px;
    font-size: ${theme.fontSizeSM}px;
  `}
`;

const EntryTime = styled.span`
  ${({ theme }) => `
    color: ${theme.colorTextTertiary};
    white-space: nowrap;
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
    <Container expanded={expanded} data-test="version-history-current-version">
      <Header
        role="button"
        tabIndex={0}
        onClick={toggle}
        onKeyDown={handleKeyDown}
        aria-expanded={expanded}
        aria-label={t('Current version')}
      >
        <CaretWrapper>
          {expanded ? (
            <Icons.DownOutlined iconSize="s" />
          ) : (
            <Icons.RightOutlined iconSize="s" />
          )}
        </CaretWrapper>
        <Title>{t('Current version')}</Title>
      </Header>
      {expanded && (
        <>
          {restoreNotice && <Entry>{restoreNotice}</Entry>}
          {entries.map(entry => (
            <Entry key={`${entry.controlName}-${entry.ts}`}>
              <span>{entry.label}</span>
              <EntryTime>{extendedDayjs(entry.ts).fromNow()}</EntryTime>
            </Entry>
          ))}
        </>
      )}
    </Container>
  );
}

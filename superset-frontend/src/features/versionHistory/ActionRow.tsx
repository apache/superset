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
import { KeyboardEvent } from 'react';
import { styled } from '@apache-superset/core/theme';
import type { ActivityRecord } from './types';
import {
  describeRecord,
  formatAuthor,
  formatVersionDateTimeShort,
} from './display';

const Row = styled.div`
  ${({ theme }) => `
    display: flex;
    align-items: stretch;
    gap: ${theme.sizeUnit * 4}px;
    cursor: pointer;
    border-radius: ${theme.borderRadius}px;
    &:hover {
      background-color: ${theme.colorBgTextHover};
    }
  `}
`;

const Rail = styled.div`
  ${({ theme }) => `
    width: ${theme.sizeUnit * 4}px;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding-top: ${theme.sizeUnit * 1.5}px;
  `}
`;

const Dot = styled.span<{ isActive: boolean }>`
  ${({ theme, isActive }) => `
    width: ${theme.sizeUnit * 2.5}px;
    height: ${theme.sizeUnit * 2.5}px;
    flex-shrink: 0;
    border-radius: 50%;
    border: 2px solid ${isActive ? theme.colorPrimary : theme.colorBorder};
    background-color: ${theme.colorBgContainer};
  `}
`;

const Connector = styled.span`
  ${({ theme }) => `
    flex: 1;
    width: 1px;
    margin-top: ${theme.sizeUnit / 2}px;
    background-color: ${theme.colorSplit};
  `}
`;

const Content = styled.div`
  ${({ theme }) => `
    flex: 1;
    min-width: 0;
    padding-bottom: ${theme.sizeUnit * 5}px;
  `}
`;

const Title = styled.div`
  ${({ theme }) => `
    font-size: ${theme.fontSize}px;
    line-height: ${theme.lineHeight};
    color: ${theme.colorText};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `}
`;

const Meta = styled.div`
  ${({ theme }) => `
    color: ${theme.colorTextTertiary};
    font-size: ${theme.fontSizeSM}px;
    line-height: ${theme.lineHeightSM};
  `}
`;

export interface ActionRowProps {
  record: ActivityRecord;
  /**
   * True when the row belongs to the active group — the current (live)
   * version at rest, or a historical version while previewed. Drives the
   * active timeline dot.
   */
  isHighlighted: boolean;
  isLast: boolean;
  onPreview: () => void;
}

export default function ActionRow({
  record,
  isHighlighted,
  isLast,
  onPreview,
}: ActionRowProps) {
  const label = describeRecord(record);
  const meta = `${formatAuthor(record.changed_by)} · ${formatVersionDateTimeShort(
    record.issued_at,
  )}`;
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // Only activate when the row itself has focus.
    if (event.target !== event.currentTarget) {
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onPreview();
    }
  };

  return (
    <Row
      // eslint-disable-next-line jsx-a11y/prefer-tag-over-role -- timeline layout uses a focusable row with explicit keyboard activation
      role="button"
      tabIndex={0}
      onClick={onPreview}
      onKeyDown={handleKeyDown}
      data-test="version-history-action-row"
    >
      <Rail>
        <Dot isActive={isHighlighted} />
        {!isLast && <Connector />}
      </Rail>
      <Content>
        <Title title={label}>{label}</Title>
        <Meta>{meta}</Meta>
      </Content>
    </Row>
  );
}

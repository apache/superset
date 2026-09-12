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
 * @fileoverview The agent profile picker.
 *
 * A profile decides which tools the assistant may use, so the choice is worth
 * surfacing — but it belongs in the header, small, and it is a pick-one menu
 * rather than a form field.
 *
 * A dropdown rather than a `Select` for two reasons. The shared `Select` sorts
 * the chosen option to the top of its own list, independently of any
 * `sortComparator`, so picking a profile rearranged the menu — and the order is
 * meaningful here: the server returns the everyday profile first and the slower,
 * more thorough ones after. And each profile needs its description shown, which a
 * one-line option can only manage as a hover tooltip; here it sits under the name
 * where it can actually be read.
 */

import { styled } from '@apache-superset/core/theme';
import { t } from '@apache-superset/core/translation';
import { Dropdown, Typography } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import type { AiAgent } from '../types';

const AgentGroup = styled.div<{ showBorder: boolean }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.sizeUnit}px;
  margin-right: ${({ theme }) => theme.sizeUnit * 2}px;
  padding-right: ${({ theme }) => theme.sizeUnit * 2}px;
  border-right: ${({ theme, showBorder }) =>
    showBorder ? `1px solid ${theme.colorBorderSecondary}` : 'none'};
`;

const AgentLabel = styled(Typography.Text)`
  font-size: ${({ theme }) => theme.fontSizeSM}px;
  white-space: nowrap;
`;

/**
 * The trigger.
 *
 * Sized to a ceiling rather than to its content, so choosing a longer profile
 * name does not shift the rest of the header.
 */
const AgentTrigger = styled.button<{ compact: boolean }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.sizeUnit}px;
  max-width: ${({ theme, compact }) => theme.sizeUnit * (compact ? 34 : 48)}px;
  padding: ${({ theme }) => theme.sizeUnit / 2}px
    ${({ theme }) => theme.sizeUnit}px;
  border: none;
  background: none;
  cursor: pointer;
  color: ${({ theme }) => theme.colorText};
  font-size: ${({ theme }) => theme.fontSizeSM}px;
  border-radius: ${({ theme }) => theme.borderRadiusSM}px;

  &:hover {
    background: ${({ theme }) => theme.colorFillTertiary};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colorPrimaryBorder};
    outline-offset: 1px;
  }
`;

const TriggerName = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Caret = styled(Icons.DownOutlined)`
  color: ${({ theme }) => theme.colorTextTertiary};
  flex: 0 0 auto;
`;

const Menu = styled.div`
  min-width: ${({ theme }) => theme.sizeUnit * 60}px;
  max-width: ${({ theme }) => theme.sizeUnit * 80}px;
  padding: ${({ theme }) => theme.sizeUnit}px;
  background: ${({ theme }) => theme.colorBgElevated};
  border-radius: ${({ theme }) => theme.borderRadiusLG}px;
  box-shadow: ${({ theme }) => theme.boxShadowSecondary};
`;

const MenuItem = styled.button<{ selected: boolean }>`
  display: flex;
  align-items: flex-start;
  gap: ${({ theme }) => theme.sizeUnit * 2}px;
  width: 100%;
  padding: ${({ theme }) => theme.sizeUnit * 1.5}px
    ${({ theme }) => theme.sizeUnit * 2}px;
  border: none;
  background: ${({ theme, selected }) =>
    selected ? theme.colorFillTertiary : 'none'};
  border-radius: ${({ theme }) => theme.borderRadiusSM}px;
  cursor: pointer;
  text-align: left;

  &:hover {
    background: ${({ theme }) => theme.colorFillSecondary};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colorPrimaryBorder};
    outline-offset: -2px;
  }
`;

/** Reserves the tick's width on every row, so the names line up regardless. */
const Tick = styled.span`
  flex: 0 0 ${({ theme }) => theme.sizeUnit * 4}px;
  padding-top: 2px;
  color: ${({ theme }) => theme.colorPrimary};
`;

const ItemText = styled.span`
  display: flex;
  flex-direction: column;
  min-width: 0;
`;

const ItemName = styled.span`
  color: ${({ theme }) => theme.colorText};
  font-size: ${({ theme }) => theme.fontSize}px;
`;

const ItemDescription = styled.span`
  color: ${({ theme }) => theme.colorTextTertiary};
  font-size: ${({ theme }) => theme.fontSizeSM}px;
  line-height: 1.4;
`;

interface ChatAgentSelectProps {
  agents: AiAgent[];
  selectedAgent: string;
  onChange: (agentKey: string) => void;
  compact?: boolean;
  showBorder?: boolean;
}

export const ChatAgentSelect = ({
  agents,
  selectedAgent,
  onChange,
  compact = true,
  showBorder = true,
}: ChatAgentSelectProps) => {
  const current = agents.find(agent => agent.key === selectedAgent);

  // Rendered in the order the server sent, every time: nothing here reorders on
  // selection, which is the whole reason this is not a `Select`.
  const menu = (
    <Menu data-test="chat-agent-menu" aria-label={t('Chat agent')}>
      {agents.map(agent => {
        const selected = agent.key === selectedAgent;
        return (
          <MenuItem
            key={agent.key}
            type="button"
            selected={selected}
            aria-pressed={selected}
            onClick={() => onChange(agent.key)}
          >
            <Tick>{selected && <Icons.CheckOutlined iconSize="s" />}</Tick>
            <ItemText>
              <ItemName data-test="chat-agent-option-name">
                {agent.name}
              </ItemName>
              {agent.description && (
                <ItemDescription>{agent.description}</ItemDescription>
              )}
            </ItemText>
          </MenuItem>
        );
      })}
    </Menu>
  );

  return (
    <AgentGroup showBorder={showBorder} data-test="chat-agent-select">
      <AgentLabel type="secondary">{t('Agent')}</AgentLabel>
      <Dropdown
        dropdownRender={() => menu}
        trigger={['click']}
        placement="bottomRight"
      >
        <AgentTrigger
          type="button"
          compact={compact}
          aria-label={t('Chat agent')}
          data-test="chat-agent-trigger"
        >
          <TriggerName>{current?.name ?? t('Default')}</TriggerName>
          <Caret iconSize="s" />
        </AgentTrigger>
      </Dropdown>
    </AgentGroup>
  );
};

export default ChatAgentSelect;

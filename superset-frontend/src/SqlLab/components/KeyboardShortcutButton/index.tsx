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
import { styled, t, css } from '@superset-ui/core';
import ModalTrigger from 'src/components/ModalTrigger';
import { detectOS } from 'src/utils/common';

const userOS = detectOS();

export enum KeyboardShortcut {
  CTRL_R = 'ctrl+r',
  CTRL_ENTER = 'ctrl+enter',
  CTRL_SHIFT_ENTER = 'ctrl+shift+enter',
  CTRL_P = 'ctrl+p',
  CTRL_Q = 'ctrl+q',
  CTRL_E = 'ctrl+e',
  CTRL_T = 'ctrl+t',
  CTRL_X = 'ctrl+x',
  ALT_ENTER = 'alt+enter',
  CMD_F = 'cmd+f',
  CMD_OPT_F = 'cmd+opt+f',
  CTRL_F = 'ctrl+f',
  CTRL_H = 'ctrl+h',
  CTRL_SHIFT_F = 'ctrl+shift+f',
}

export const KEY_MAP = {
  [KeyboardShortcut.CTRL_R]: t('Run query'),
  [KeyboardShortcut.CTRL_ENTER]: t('Run query'),
  [KeyboardShortcut.ALT_ENTER]: t('Run query'),
  [KeyboardShortcut.CTRL_SHIFT_ENTER]: t('Run current query'),
  [KeyboardShortcut.CTRL_X]: userOS === 'MacOS' ? t('Stop query') : undefined,
  [KeyboardShortcut.CTRL_E]: userOS !== 'MacOS' ? t('Stop query') : undefined,
  [KeyboardShortcut.CTRL_Q]: userOS === 'Windows' ? t('New tab') : undefined,
  [KeyboardShortcut.CTRL_T]: userOS !== 'Windows' ? t('New tab') : undefined,
  [KeyboardShortcut.CTRL_P]: t('Previous Line'),
  [KeyboardShortcut.CTRL_SHIFT_F]: t('Format SQL'),
  // default ace editor shortcuts
  [KeyboardShortcut.CMD_F]: userOS === 'MacOS' ? t('Find') : undefined,
  [KeyboardShortcut.CTRL_F]: userOS !== 'MacOS' ? t('Find') : undefined,
  [KeyboardShortcut.CMD_OPT_F]: userOS === 'MacOS' ? t('Replace') : undefined,
  [KeyboardShortcut.CTRL_H]: userOS !== 'MacOS' ? t('Replace') : undefined,
};

const KeyMapByCommand = Object.entries(KEY_MAP).reduce(
  (acc, [shortcut, command]) => {
    if (command) {
      acc[command] = [...(acc[command] || []), shortcut];
    }
    return acc;
  },
  {} as Record<string, string[]>,
);

const ShortcutDescription = styled.span`
  font-size: ${({ theme }) => theme.typography.sizes.m}px;
  color: ${({ theme }) => theme.colors.text.help};
  padding-left: ${({ theme }) => theme.gridUnit * 2}px;
`;

const ShortcutWrapper = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.gridUnit}px;
  padding: ${({ theme }) => theme.gridUnit * 2}px;
`;

const ShortcutCode = styled.code`
  font-size: ${({ theme }) => theme.typography.sizes.s}px;
  color: ${({ theme }) => theme.colors.grayscale.dark1};
  border-radius: ${({ theme }) => theme.borderRadius}px;
  padding: ${({ theme }) => `${theme.gridUnit}px ${theme.gridUnit * 2}px`};
`;

const KeyboardShortcutButton: React.FC<{}> = ({ children }) => (
  <ModalTrigger
    modalTitle={t('Keyboard shortcuts')}
    modalBody={
      <div>
        {Object.entries(KeyMapByCommand).map(([description, shortcuts]) => (
          <div
            key={description}
            css={css`
              display: table-row;
            `}
          >
            <div
              css={css`
                display: table-cell;
                max-width: 200px;
                vertical-align: middle;
              `}
            >
              <ShortcutDescription>{description}</ShortcutDescription>
            </div>
            <div
              css={css`
                display: table-cell;
              `}
            >
              <ShortcutWrapper>
                {shortcuts.map(shortcut => (
                  <ShortcutCode key={shortcut}>{shortcut}</ShortcutCode>
                ))}
              </ShortcutWrapper>
            </div>
          </div>
        ))}
      </div>
    }
    triggerNode={children}
  />
);

export default KeyboardShortcutButton;

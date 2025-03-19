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
import { FC } from 'react';
import { styled, t, css } from '@superset-ui/core';
import ModalTrigger from 'src/components/ModalTrigger';
import { detectOS } from 'src/utils/common';

const userOS = detectOS();

export enum KeyboardShortcut {
  CtrlR = 'ctrl+r',
  CtrlEnter = 'ctrl+enter',
  CtrlShiftEnter = 'ctrl+shift+enter',
  CtrlP = 'ctrl+p',
  CtrlQ = 'ctrl+q',
  CtrlE = 'ctrl+e',
  CtrlT = 'ctrl+t',
  CtrlX = 'ctrl+x',
  AltEnter = 'alt+enter',
  CmdF = 'cmd+f',
  CmdOptF = 'cmd+opt+f',
  CtrlF = 'ctrl+f',
  CtrlH = 'ctrl+h',
  CtrlShiftF = 'ctrl+shift+f',
  CtrlLeft = 'ctrl+[',
  CtrlRight = 'ctrl+]',
}

export const KEY_MAP = {
  [KeyboardShortcut.CtrlR]: t('Run query'),
  [KeyboardShortcut.CtrlEnter]: t('Run query'),
  [KeyboardShortcut.AltEnter]: t('Run query'),
  [KeyboardShortcut.CtrlShiftEnter]: t('Run current query'),
  [KeyboardShortcut.CtrlX]: userOS === 'MacOS' ? t('Stop query') : undefined,
  [KeyboardShortcut.CtrlE]: userOS !== 'MacOS' ? t('Stop query') : undefined,
  [KeyboardShortcut.CtrlQ]: userOS === 'Windows' ? t('New tab') : undefined,
  [KeyboardShortcut.CtrlT]: userOS !== 'Windows' ? t('New tab') : undefined,
  [KeyboardShortcut.CtrlP]: t('Previous Line'),
  [KeyboardShortcut.CtrlShiftF]: t('Format SQL'),
  [KeyboardShortcut.CtrlLeft]: t('Switch to the previous tab'),
  [KeyboardShortcut.CtrlRight]: t('Switch to the next tab'),
  // default ace editor shortcuts
  [KeyboardShortcut.CmdF]: userOS === 'MacOS' ? t('Find') : undefined,
  [KeyboardShortcut.CtrlF]: userOS !== 'MacOS' ? t('Find') : undefined,
  [KeyboardShortcut.CmdOptF]: userOS === 'MacOS' ? t('Replace') : undefined,
  [KeyboardShortcut.CtrlH]: userOS !== 'MacOS' ? t('Replace') : undefined,
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

const KeyboardShortcutButton: FC<{}> = ({ children }) => (
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

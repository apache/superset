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
import { useEffect } from 'react';
import { css, styled } from '@apache-superset/core/theme';
import { t } from '@apache-superset/core/translation';
import { Button, Icons, Tooltip } from '@superset-ui/core/components';
import { chat, useChat } from 'src/core';
import type { DraftActions } from './useDraftActions';
import type { DraftHistory } from './useDraftHistory';

const Bar = styled.div`
  ${({ theme }) => css`
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: ${theme.sizeUnit * 2}px;
  `}
`;

export interface CanvasToolbarProps {
  /** Whether this user may edit at all; the switch is theirs alone. */
  canEdit: boolean;
  /** Set while a draft is open. */
  draftToken?: string;
  /** Start a draft and show it. */
  onEnter: () => void;
  /** Whether a layout write is still in flight. */
  saving: boolean;
  history: DraftHistory;
  actions: DraftActions;
  /** Whether a draft is being started. */
  starting?: boolean;
}

/**
 * The canvas's own controls: a way into editing, and a way to the assistant.
 *
 * What can be done *to* a draft -- undo, redo, save, discard -- is in the
 * banner, which only exists while one is open. So editing is entered here
 * and left there, and the way in disappears once it has been taken.
 *
 * The assistant stays for everyone, including someone who may not edit: a
 * canvas is read through it as much as it is built with it.
 */
export default function CanvasToolbar({
  canEdit,
  draftToken,
  onEnter,
  saving,
  history,
  actions,
  starting = false,
}: CanvasToolbarProps) {
  const editing = Boolean(draftToken);
  const { chat: registeredChat } = useChat();
  // Either action ends the draft, so neither should run twice.
  const busy = actions.busy || history.busy || starting;
  // A step is held while a layout write is in flight: it replays the draft
  // from its op log, and a drop still on its way there is not in that log.
  const steppable = editing && !saving && !busy;
  const canUndo = steppable && history.canUndo;
  const canRedo = steppable && history.canRedo;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      // event.code as a fallback: on a non-Latin layout event.key is a
      // different glyph for the same physical key.
      const isZ = key === 'z' || event.code === 'KeyZ';
      const isY = key === 'y' || event.code === 'KeyY';
      const undoing = isZ && !event.shiftKey;
      const redoing = isY || (isZ && event.shiftKey);
      if (!undoing && !redoing) return;
      // Inside a text field the shortcut belongs to the field.
      const target = event.target as HTMLElement | null;
      if (
        target?.isContentEditable ||
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA'
      ) {
        return;
      }
      if (undoing ? !canUndo : !canRedo) return;
      event.preventDefault();
      if (undoing) history.undo();
      else history.redo();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [canUndo, canRedo, history.undo, history.redo]);

  return (
    <Bar data-test="canvas-toolbar">
      {canEdit && !editing && (
        <Tooltip title={t('Edit canvas')} placement="bottom">
          <Button
            buttonStyle="tertiary"
            icon={<Icons.EditOutlined iconSize="m" />}
            loading={starting}
            disabled={busy}
            onClick={onEnter}
            aria-label={t('Edit canvas')}
            data-test="canvas-edit"
          />
        </Tooltip>
      )}
      {registeredChat && (
        <Button
          buttonStyle="primary"
          icon={<Icons.ThunderboltOutlined iconSize="m" />}
          onClick={() => {
            chat.setDisplayMode('panel');
            chat.open();
          }}
          data-test="canvas-ai"
        >
          {t('AI assistant')}
        </Button>
      )}
    </Bar>
  );
}

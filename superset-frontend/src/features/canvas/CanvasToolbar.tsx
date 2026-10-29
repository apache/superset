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
import { useEffect, useState } from 'react';
import { css, styled } from '@apache-superset/core/theme';
import { t } from '@apache-superset/core/translation';
import {
  Button,
  Divider,
  Icons,
  Modal,
  Space,
  Switch,
  Tooltip,
  Typography,
} from '@superset-ui/core/components';
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

/**
 * A dot beside the label while the draft holds changes nobody else can see,
 * so the switch says what state the canvas is in and not only which mode it
 * is.
 */
const Unpublished = styled.span`
  ${({ theme }) => css`
    display: inline-block;
    width: ${theme.sizeUnit}px;
    height: ${theme.sizeUnit}px;
    margin-left: ${theme.sizeUnit}px;
    border-radius: 50%;
    background: ${theme.colorPrimary};
    vertical-align: middle;
  `}
`;

export interface CanvasToolbarProps {
  /** Whether this user may edit at all; the switch is theirs alone. */
  canEdit: boolean;
  /** Set while a draft is open. */
  draftToken?: string;
  /** Whether the draft holds changes that have not been published. */
  unpublished: boolean;
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
 * The canvas's own controls: which mode it is in, and -- in a draft -- what
 * can be done to it.
 *
 * Undo, redo, publish and discard are shown only in a draft. They mean
 * nothing on a published canvas, and a row of disabled buttons says less
 * than no row at all.
 */
export default function CanvasToolbar({
  canEdit,
  draftToken,
  unpublished,
  onEnter,
  saving,
  history,
  actions,
  starting = false,
}: CanvasToolbarProps) {
  const editing = Boolean(draftToken);
  // Asked before leaving a draft that still holds changes: the draft is the
  // only copy of them, and the eye is one click away from the hand.
  const [leaving, setLeaving] = useState(false);
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

  if (!canEdit) return null;

  const leave = () => {
    if (unpublished) {
      setLeaving(true);
      return;
    }
    // Nothing to lose: a draft with no changes is just a mode.
    actions.discard();
  };

  return (
    <Bar data-test="canvas-toolbar">
      {editing && (
        <Space size={0} data-test="canvas-history">
          <Tooltip title={t('Undo')} placement="bottom">
            {/* Wrapped: a disabled button reports no pointer events, so the
                tooltip would never open on the thing it explains. */}
            <span>
              <Button
                buttonStyle="link"
                aria-label={t('Undo')}
                disabled={!canUndo}
                onClick={history.undo}
                data-test="canvas-undo"
              >
                <Icons.Undo iconSize="xl" />
              </Button>
            </span>
          </Tooltip>
          <Tooltip title={t('Redo')} placement="bottom">
            <span>
              <Button
                buttonStyle="link"
                aria-label={t('Redo')}
                disabled={!canRedo}
                onClick={history.redo}
                data-test="canvas-redo"
              >
                <Icons.Redo iconSize="xl" />
              </Button>
            </span>
          </Tooltip>
          {/* The two groups do different things -- one steps the draft, the
              other decides what happens to it -- so they read as two. */}
          <Divider type="vertical" />
        </Space>
      )}

      {/* A switch with its name beside it, rather than a label inside the
          track: the track has room for a word, not for one that also has to
          stay legible at the moment it slides. */}
      <Tooltip
        title={editing ? t('Switch to view mode') : t('Switch to draft mode')}
        placement="bottom"
      >
        <Space size="small">
          <Switch
            checked={editing}
            disabled={busy}
            loading={starting}
            onChange={checked => (checked ? onEnter() : leave())}
            aria-labelledby="canvas-mode-label"
            data-test="canvas-mode-switch"
          />
          <Typography.Text id="canvas-mode-label">
            {t('Draft mode')}
            {unpublished && <Unpublished data-test="canvas-unpublished" />}
          </Typography.Text>
        </Space>
      </Tooltip>

      {editing && (
        <Space>
          <Button
            buttonStyle="primary"
            loading={actions.busy}
            disabled={saving || busy}
            onClick={actions.publish}
            tooltip={saving ? t('Saving your changes…') : undefined}
            data-test="canvas-draft-publish"
          >
            {t('Publish')}
          </Button>
          <Button
            disabled={saving || busy}
            onClick={actions.discard}
            tooltip={saving ? t('Saving your changes…') : undefined}
            data-test="canvas-draft-discard"
          >
            {t('Discard')}
          </Button>
        </Space>
      )}

      {/* Both footer buttons end the draft, which is why they say so: the
          toolbar's own Publish and Discard stay where they are, and a modal
          repeating their labels would read as the same two buttons again. */}
      <Modal
        show={leaving}
        onHide={() => setLeaving(false)}
        title={
          <Space size="small">
            <Icons.WarningOutlined iconSize="m" />
            {t('Leave draft mode?')}
          </Space>
        }
        width="444px"
        centered
        responsive
        destroyOnHidden
        footer={
          <>
            <Button
              buttonStyle="secondary"
              onClick={async () => {
                setLeaving(false);
                await actions.discard();
              }}
            >
              {t('Discard and leave')}
            </Button>
            <Button
              buttonStyle="primary"
              onClick={async () => {
                setLeaving(false);
                await actions.publish();
              }}
            >
              {t('Publish and leave')}
            </Button>
          </>
        }
      >
        <Typography.Text>
          {t(
            'This draft has changes that nobody else can see yet. Publish them, or discard the draft.',
          )}
        </Typography.Text>
      </Modal>
    </Bar>
  );
}

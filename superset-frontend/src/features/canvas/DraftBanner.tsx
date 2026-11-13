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
import { t } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import { Alert } from '@apache-superset/core/components';
import {
  Button,
  Divider,
  Icons,
  Popover,
  Space,
  Tag,
} from '@superset-ui/core/components';
import type { DraftActions } from './useDraftActions';
import type { DraftHistory } from './useDraftHistory';
import type { DraftChange } from './types';
import { MARKS } from './changeMarks';

/**
 * The count, as a quiet disclosure rather than a link.
 *
 * It sits inside a sentence, and a link there reads as somewhere to navigate
 * to. This opens a list in place, so it is styled as the thing it is: the
 * sentence's own words, with a chevron to say there is more, and a wash while
 * the list is open.
 */
const Count = styled.button<{ $open: boolean }>`
  ${({ theme, $open }) => css`
    display: inline-flex;
    align-items: center;
    gap: ${theme.sizeUnit / 2}px;
    height: ${theme.sizeUnit * 6}px;
    margin-left: ${theme.sizeUnit * 2}px;
    padding: 0 ${theme.sizeUnit * 1.5}px;
    border: none;
    border-radius: ${theme.borderRadiusSM}px;
    background: ${$open ? theme.colorFillSecondary : 'transparent'};
    color: ${theme.colorTextSecondary};
    font-weight: ${theme.fontWeightStrong};
    cursor: pointer;
    transition: background-color ${theme.motionDurationMid};

    &:hover {
      background: ${theme.colorFillTertiary};
    }

    &:focus-visible {
      outline: 2px solid ${theme.colorPrimaryBorder};
      outline-offset: -2px;
    }
  `}
`;

/** One change, as a row: what was done, to what, by whom. */
/**
 * A row contributes its three cells to the grid above rather than laying
 * them out itself, which is what keeps the columns of different rows in step.
 */
const Change = styled.div`
  ${({ theme }) => css`
    display: contents;

    > * {
      white-space: nowrap;
    }

    .change-who {
      color: ${theme.colorTextTertiary};
    }
  `}
`;

/**
 * The list itself is the grid, not each row.
 *
 * Three columns -- what happened, what it happened to, who did it -- sized
 * once for the whole list, so every name begins at the same place. Laid out a
 * row at a time, each tag sized to its own word and "Resized" pushed its name
 * further right than "Moved" did, leaving the column ragged.
 */
const Changes = styled.div`
  ${({ theme }) => css`
    min-width: ${theme.sizeUnit * 60}px;
    max-height: ${theme.sizeUnit * 80}px;
    overflow-y: auto;
    padding: ${theme.sizeUnit * 2}px;
    background: ${theme.colorBgElevated};
    border-radius: ${theme.borderRadius}px;
    box-shadow: ${theme.boxShadowSecondary};
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: baseline;
    column-gap: ${theme.sizeUnit * 2}px;
    row-gap: ${theme.sizeUnit * 2}px;
  `}
`;

const Controls = styled(Space)`
  flex: none;
`;

interface DraftBannerProps {
  /** Steps the draft back and forward. */
  history: DraftHistory;
  /** Publishes the draft, or throws it away. */
  actions: DraftActions;
  /** True while a layout write is still in flight or queued. */
  saving: boolean;
  /** What the draft holds, newest first. */
  changes?: DraftChange[];
  /** Whether the draft holds nothing, so there is nothing to save. */
  empty?: boolean;
  /** Node id -> the name shown above it, for naming each change. */
  titles?: Record<string, string>;
}

/**
 * Says that a canvas is being edited privately, and carries what to do about
 * it.
 *
 * Everything that acts on the draft is here rather than in the page header:
 * the banner is the one thing on screen that only exists while a draft does,
 * so it is where a reader already looks to find out what state they are in.
 * The mode switch stays in the header, because it is how you get here and has
 * to be reachable when there is no banner.
 */
export default function DraftBanner({
  history,
  actions,
  saving,
  changes,
  empty,
  titles = {},
}: DraftBannerProps) {
  // Held here so the count can show it is the thing that is open.
  const [listing, setListing] = useState(false);
  const busy = actions.busy || history.busy;
  // Held while a write is still going: publishing then would commit the older
  // revision and drop the change the user just made.
  const steppable = !saving && !busy;
  // A draft that holds nothing has nothing to save, which is what undoing
  // back to the start leaves behind.
  //
  // Asked of the draft rather than of the list beside it: an operation with
  // no node to name it after -- a canvas setting -- takes effect and lists
  // nothing, so a draft that only changed a setting lists nothing while very
  // much having something to save.
  //
  // Only when the server has said so. Left undefined -- an older server --
  // the button stays live, because disabling the one way to keep the work on
  // the strength of a missing field is the worse way to be wrong.
  const nothingToSave = empty === true;
  return (
    <Alert
      type="warning"
      showIcon
      // The banner is what says a draft is open, and it carries the only way
      // to close one. Dismissing it would hide the state and its exits.
      closable={false}
      message={
        <>
          {t('Draft. Only you can see these changes.')}
          {changes !== undefined && changes.length > 0 && (
            <Popover
              trigger="click"
              placement="bottomLeft"
              open={listing}
              onOpenChange={setListing}
              content={
                <Changes data-test="canvas-change-list">
                  {changes.map((change, index) => (
                    <Change
                      // Nothing on a change identifies it: the same widget can
                      // be moved twice, and both entries are real.
                      // eslint-disable-next-line react/no-array-index-key
                      key={index}
                    >
                      <Tag color={MARKS[change.kind].color}>
                        {MARKS[change.kind].label()}
                      </Tag>
                      <span>{titles[change.nodeId] ?? change.nodeId}</span>
                      <span className="change-who">
                        {change.by === 'ai' ? t('AI') : t('You')}
                      </span>
                    </Change>
                  ))}
                </Changes>
              }
            >
              <Count
                type="button"
                $open={listing}
                data-test="canvas-draft-changes"
              >
                {t('%s change(s)', changes.length)}
                <Icons.DownOutlined iconSize="xs" />
              </Count>
            </Popover>
          )}
        </>
      }
      action={
        <Controls size="small">
          <Button
            buttonStyle="link"
            aria-label={t('Undo')}
            disabled={!steppable || !history.canUndo}
            onClick={history.undo}
            data-test="canvas-undo"
          >
            <Icons.Undo iconSize="l" />
          </Button>
          <Button
            buttonStyle="link"
            aria-label={t('Redo')}
            disabled={!steppable || !history.canRedo}
            onClick={history.redo}
            data-test="canvas-redo"
          >
            <Icons.Redo iconSize="l" />
          </Button>
          {/* The two groups do different things -- one steps the draft, the
              other decides what happens to it -- so they read as two. */}
          <Divider type="vertical" />
          <Button
            buttonStyle="secondary"
            disabled={saving || busy}
            onClick={actions.discard}
            tooltip={saving ? t('Saving your changes…') : undefined}
            data-test="canvas-draft-discard"
          >
            {t('Discard')}
          </Button>
          <Button
            buttonStyle="primary"
            loading={actions.busy}
            disabled={saving || busy || nothingToSave}
            onClick={actions.publish}
            tooltip={
              (saving && t('Saving your changes…')) ||
              (nothingToSave && t('Nothing to save yet')) ||
              undefined
            }
            data-test="canvas-draft-publish"
          >
            {t('Save')}
          </Button>
        </Controls>
      }
      data-test="canvas-draft-banner"
    />
  );
}

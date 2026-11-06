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

/** What each kind of change is called where it is listed. */
const KINDS: Record<DraftChange['kind'], () => string> = {
  new: () => t('New'),
  removed: () => t('Removed'),
  moved: () => t('Moved'),
  resized: () => t('Resized'),
  edited: () => t('Edited'),
};

const Count = styled(Button)`
  ${({ theme }) => css`
    margin-left: ${theme.sizeUnit * 2}px;
    padding: 0;
    height: auto;
  `}
`;

/** One change, as a row: what was done, to what, by whom. */
const Change = styled.div`
  ${({ theme }) => css`
    display: flex;
    align-items: baseline;
    gap: ${theme.sizeUnit * 2}px;
    padding: ${theme.sizeUnit}px 0;
    white-space: nowrap;

    .change-who {
      margin-left: auto;
      color: ${theme.colorTextTertiary};
    }
  `}
`;

const Changes = styled.div`
  ${({ theme }) => css`
    min-width: ${theme.sizeUnit * 60}px;
    max-height: ${theme.sizeUnit * 80}px;
    overflow-y: auto;
    padding: ${theme.sizeUnit * 2}px;
    background: ${theme.colorBgElevated};
    border-radius: ${theme.borderRadius}px;
    box-shadow: ${theme.boxShadowSecondary};
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
  titles = {},
}: DraftBannerProps) {
  const busy = actions.busy || history.busy;
  // Held while a write is still going: publishing then would commit the older
  // revision and drop the change the user just made.
  const steppable = !saving && !busy;
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
              content={
                <Changes data-test="canvas-change-list">
                  {changes.map((change, index) => (
                    <Change
                      // Nothing on a change identifies it: the same widget can
                      // be moved twice, and both entries are real.
                      // eslint-disable-next-line react/no-array-index-key
                      key={index}
                    >
                      <Tag>{KINDS[change.kind]()}</Tag>
                      <span>{titles[change.nodeId] ?? change.nodeId}</span>
                      <span className="change-who">
                        {change.by === 'ai' ? t('AI') : t('You')}
                      </span>
                    </Change>
                  ))}
                </Changes>
              }
            >
              <Count buttonStyle="link" data-test="canvas-draft-changes">
                {t('%s change(s)', changes.length)}
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
            disabled={saving || busy}
            onClick={actions.publish}
            tooltip={saving ? t('Saving your changes…') : undefined}
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

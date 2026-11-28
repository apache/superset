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
import { t } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import { Alert } from '@apache-superset/core/components';
import { Drawer, Loading, Tag } from '@superset-ui/core/components';
import {
  formatAuthor,
  formatVersionDateTime,
} from 'src/features/versionHistory/display';
import type { CanvasVersionHistory as History } from './useCanvasVersionHistory';
import { describeCanvasVersion, versionLabel } from './describeVersion';

const Entry = styled.button<{ selected: boolean }>`
  ${({ theme, selected }) => css`
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit}px;
    width: 100%;
    padding: ${theme.sizeUnit * 3}px ${theme.sizeUnit * 4}px;
    border: 0;
    border-bottom: 1px solid ${theme.colorSplit};
    background: ${selected ? theme.colorPrimaryBg : 'transparent'};
    color: ${theme.colorText};
    text-align: left;
    cursor: pointer;

    &:hover {
      background: ${selected ? theme.colorPrimaryBg : theme.colorFillTertiary};
    }
  `}
`;

const Headline = styled.span`
  ${({ theme }) => css`
    display: flex;
    align-items: center;
    gap: ${theme.sizeUnit * 2}px;
    font-weight: ${theme.fontWeightStrong};
  `}
`;

const Meta = styled.span`
  ${({ theme }) => css`
    color: ${theme.colorTextSecondary};
    font-size: ${theme.fontSizeSM}px;
  `}
`;

interface CanvasVersionHistoryProps {
  open: boolean;
  onClose: () => void;
  history: History;
}

/**
 * The canvas' saves, newest first. Picking one previews it in place of the
 * live canvas; picking the latest goes back to the live canvas.
 */
export default function CanvasVersionHistory({
  open,
  onClose,
  history,
}: CanvasVersionHistoryProps) {
  const {
    versions,
    preview,
    loading,
    error,
    reload,
    showVersion,
    showCurrent,
  } = history;
  const shown = preview?._version.version_uuid;

  // Others may have saved since the list loaded.
  useEffect(() => {
    if (open) reload();
  }, [open, reload]);

  return (
    <Drawer
      title={t('Version history')}
      open={open}
      onClose={onClose}
      width={360}
      mask={false}
      styles={{ body: { padding: 0 } }}
    >
      {error && <Alert type="error" message={error} closable={false} />}
      {versions === undefined && !error && <Loading position="normal" />}
      {versions?.map((version, index) => {
        const current = index === 0;
        const selected = current
          ? shown === undefined
          : shown === version.version_uuid;
        return (
          <Entry
            key={version.version_uuid}
            type="button"
            selected={selected}
            aria-pressed={selected}
            data-test="canvas-version"
            onClick={() =>
              current ? showCurrent() : showVersion(version.version_uuid)
            }
          >
            <Headline>
              {describeCanvasVersion(version)}
              {current && <Tag color="success">{t('Current')}</Tag>}
              {loading === version.version_uuid && (
                <Loading position="inline" size="s" />
              )}
            </Headline>
            <Meta>
              {[
                versionLabel(version),
                formatAuthor(version.changed_by),
                formatVersionDateTime(version.issued_at),
              ].join(' · ')}
            </Meta>
          </Entry>
        );
      })}
    </Drawer>
  );
}

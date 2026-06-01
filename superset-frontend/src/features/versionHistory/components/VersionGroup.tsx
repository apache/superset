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
import { css, useTheme } from '@apache-superset/core/theme';
import { t } from '@apache-superset/core/translation';
import { Icons } from '@superset-ui/core/components';
import { EntityType } from '../types';
import { ActivityRow, ActivitySaveRow } from '../utils/groupActivity';
import VersionItem from './VersionItem';
import RelatedItemRow from './RelatedItemRow';

interface Props {
  entityType: EntityType;
  label: string;
  rows: ActivityRow[];
  selectedVersionUuid: string | null;
  currentVersionUuid: string | null;
  onSelect: (versionUuid: string) => void;
  onRestore: (save: ActivitySaveRow) => void;
  onOpenAsNew?: (save: ActivitySaveRow) => void;
}

const VersionGroup = ({
  entityType,
  label,
  rows,
  selectedVersionUuid,
  currentVersionUuid,
  onSelect,
  onRestore,
  onOpenAsNew,
}: Props) => {
  const theme = useTheme();
  const [open, setOpen] = useState(true);
  // The "Current version" bucket gets a faint green tint to set it apart
  // from the day buckets — matches the Figma reference + reinforces the
  // pinned-row affordance even when the user has scrolled past the
  // bucket header.
  const isCurrentBucket = label === t('Current version');

  return (
    <div
      data-test="version-group"
      data-test-current-bucket={isCurrentBucket ? 'true' : 'false'}
      css={css`
        background: ${isCurrentBucket ? theme.colorSuccessBg : 'transparent'};
      `}
    >
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        css={css`
          display: flex;
          align-items: center;
          gap: ${theme.sizeUnit}px;
          width: 100%;
          padding: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 3}px
            ${theme.sizeUnit * 2}px ${theme.sizeUnit * 4}px;
          background: ${theme.colorBgLayout};
          border: none;
          cursor: pointer;
          font-size: ${theme.fontSizeSM}px;
          font-weight: ${theme.fontWeightStrong};
          color: ${theme.colorTextSecondary};
          text-transform: uppercase;
        `}
        aria-expanded={open}
      >
        {open ? (
          <Icons.CaretDownOutlined iconSize="s" />
        ) : (
          <Icons.CaretRightOutlined iconSize="s" />
        )}
        {label}
      </button>
      {open &&
        rows.map(row => {
          if (row.type === 'related') {
            return (
              <RelatedItemRow
                key={`related-${row.record.version_uuid}-${row.record.path.join('/')}`}
                record={row.record}
              />
            );
          }
          return (
            <VersionItem
              key={row.version_uuid}
              entityType={entityType}
              save={row}
              selected={selectedVersionUuid === row.version_uuid}
              isCurrent={currentVersionUuid === row.version_uuid}
              // Pass parent callbacks as-is; VersionItem invokes them
              // with the row identity. Avoids per-row lambdas which would
              // break VersionItem's ``memo()`` and re-render every row
              // on every panel state change.
              onSelect={onSelect}
              onRestore={onRestore}
              onOpenAsNew={onOpenAsNew}
            />
          );
        })}
    </div>
  );
};

export default VersionGroup;

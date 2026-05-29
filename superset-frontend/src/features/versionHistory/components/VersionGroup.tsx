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
import { Icons } from '@superset-ui/core/components';
import { EntityType, Version } from '../types';
import VersionItem from './VersionItem';

interface Props {
  entityType: EntityType;
  label: string;
  versions: Version[];
  selectedVersionUuid: string | null;
  currentVersionUuid: string | null;
  onSelect: (versionUuid: string) => void;
  onRestore: (version: Version) => void;
  onOpenAsNew?: (version: Version) => void;
}

const VersionGroup = ({
  entityType,
  label,
  versions,
  selectedVersionUuid,
  currentVersionUuid,
  onSelect,
  onRestore,
  onOpenAsNew,
}: Props) => {
  const theme = useTheme();
  const [open, setOpen] = useState(true);

  return (
    <div>
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
        versions.map(version => (
          <VersionItem
            key={version.version_uuid}
            entityType={entityType}
            version={version}
            selected={selectedVersionUuid === version.version_uuid}
            isCurrent={currentVersionUuid === version.version_uuid}
            onSelect={() => onSelect(version.version_uuid)}
            onRestore={() => onRestore(version)}
            onOpenAsNew={onOpenAsNew ? () => onOpenAsNew(version) : undefined}
          />
        ))}
    </div>
  );
};

export default VersionGroup;

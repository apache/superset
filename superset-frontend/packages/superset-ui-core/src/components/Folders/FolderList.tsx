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
import { styled } from '@apache-superset/core/theme';
import { Collapse, type CollapseProps } from '../Collapse';
import { FolderIcon, assetTypeIcons } from './assetIcons';
import type { Folder, FolderItemType, FolderListProps } from './types';

type FolderCollapseItem = NonNullable<CollapseProps['items']>[number];

// Keep the header text at its content width and drop antd's auto end-margin so
// the end-positioned caret sits immediately after the folder label rather than
// at the far right of the row. The doubled root (&&) raises specificity above
// antd's `flex: auto` / `margin-inline-end: auto` rules on the header text.
const StyledFolderCollapse = styled(Collapse)`
  ${({ theme }) => `
    && .ant-collapse-item > .ant-collapse-header > .ant-collapse-header-text {
      flex: none;
      margin-inline-end: 0;
    }

    .ant-collapse-expand-icon {
      margin-inline-start: ${theme.sizeUnit}px;
    }

    /* Non-expandable rows have no caret, so let the label fill the row. */
    && .folder-row--static > .ant-collapse-header > .ant-collapse-header-text {
      flex: auto;
    }

    /* A non-expandable row that navigates on click reads as one target. */
    && .folder-row--clickable > .ant-collapse-header {
      cursor: pointer;
    }

    && .folder-row--clickable > .ant-collapse-header:hover {
      background: ${theme.colorFillTertiary};
    }
  `}
`;

const FolderLabel = styled.span`
  ${({ theme }) => `
    display: inline-flex;
    align-items: center;
    gap: ${theme.sizeUnit * 2}px;
    font-weight: ${theme.fontWeightStrong};
    color: ${theme.colorText};
  `}
`;

const AssetCount = styled.span`
  ${({ theme }) => `
    color: ${theme.colorTextTertiary};
    font-weight: normal;
    font-size: ${theme.fontSizeSM}px;
  `}
`;

const AssetList = styled.ul`
  ${({ theme }) => `
    list-style: none;
    margin: 0;
    padding: 0;

    li + li {
      border-top: 1px solid ${theme.colorBorderSecondary};
    }
  `}
`;

const AssetRow = styled.button`
  ${({ theme }) => `
    display: flex;
    align-items: center;
    gap: ${theme.sizeUnit * 2}px;
    width: 100%;
    padding: ${theme.sizeUnit * 2}px ${theme.sizeUnit}px;
    border: 0;
    background: transparent;
    color: ${theme.colorText};
    font-size: ${theme.fontSize}px;
    text-align: left;
    cursor: pointer;

    &:hover {
      background: ${theme.colorFillTertiary};
    }
  `}
`;

// Strips the native button chrome so a navigable folder row matches the look
// of an expandable header while staying a real, focusable button.
const FolderRowButton = styled.button`
  display: flex;
  align-items: center;
  width: 100%;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
`;

const iconFor = (type: FolderItemType) =>
  type === 'folder' ? FolderIcon : assetTypeIcons[type];

export function FolderList({
  folders,
  expandableTypes = [],
  defaultActiveKeys,
  accordion = false,
  showCount = true,
  onAssetClick,
  onFolderClick,
  renderExpandedContent,
  className,
}: FolderListProps) {
  const isExpandable = (folder: Folder) =>
    expandableTypes.includes(folder.type ?? 'folder');

  const defaultAssetList = (folder: Folder) => (
    <AssetList>
      {folder.assets.map(asset => {
        const AssetIcon = assetTypeIcons[asset.type];
        return (
          <li key={asset.key}>
            <AssetRow type="button" onClick={() => onAssetClick?.(asset)}>
              <AssetIcon iconSize="m" aria-hidden />
              {asset.name}
            </AssetRow>
          </li>
        );
      })}
    </AssetList>
  );

  const items = folders.map((folder): FolderCollapseItem => {
    const Icon = iconFor(folder.type ?? 'folder');
    const label = (
      <FolderLabel>
        <Icon iconSize="m" aria-hidden />
        {folder.title}
        {showCount && <AssetCount>{folder.assets.length}</AssetCount>}
      </FolderLabel>
    );

    if (isExpandable(folder)) {
      return {
        key: folder.key,
        label,
        children: renderExpandedContent?.(folder) ?? defaultAssetList(folder),
      };
    }

    // A non-expandable row carries no caret and never toggles (`collapsible:
    // 'icon'` + `showArrow: false`). With a handler the label becomes a button
    // that navigates; without one the row is an inert header.
    return {
      key: folder.key,
      showArrow: false,
      collapsible: 'icon',
      className: onFolderClick
        ? 'folder-row--static folder-row--clickable'
        : 'folder-row--static',
      label: onFolderClick ? (
        <FolderRowButton type="button" onClick={() => onFolderClick(folder)}>
          {label}
        </FolderRowButton>
      ) : (
        label
      ),
    };
  });

  // antd would still mark a key active even if its row can't expand; keep the
  // initial open set to rows that actually have a body.
  const activeKeys = defaultActiveKeys?.filter(key =>
    folders.some(folder => folder.key === key && isExpandable(folder)),
  );

  return (
    <StyledFolderCollapse
      className={className}
      items={items}
      accordion={accordion}
      expandIconPosition="end"
      defaultActiveKey={activeKeys}
    />
  );
}

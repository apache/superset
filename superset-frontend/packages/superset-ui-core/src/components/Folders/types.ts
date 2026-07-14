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
import type { ReactNode } from 'react';

/**
 * The kinds of leaf assets that can live inside a folder. Each maps to a
 * dedicated icon in `assetTypeIcons`.
 */
export type FolderAssetType = 'dashboard' | 'dataset' | 'chart';

/**
 * The kind of a top-level entry in a {@link FolderList}. A folder groups
 * assets; the asset kinds may also appear as top-level entries in their own
 * right. The type drives the row's icon and, via `expandableTypes`, whether
 * the row expands in place or navigates on click.
 */
export type FolderItemType = 'folder' | FolderAssetType;

/** A single navigable segment of the folder path. */
export interface FolderBreadcrumbItem {
  /** Stable identifier, passed back to `onClick`. */
  key: string;
  /** Label rendered for the segment. */
  title: ReactNode;
  /** Marks the segment as a link; called with the item `key` when clicked. */
  onClick?: (key: string) => void;
  /** Optional href when the segment should navigate via an anchor. */
  href?: string;
  /** Hide the leading folder icon for this segment (defaults to shown). */
  hideIcon?: boolean;
}

export interface FolderBreadcrumbProps {
  /** Ordered path from root to current folder; the last item is the current location. */
  items: FolderBreadcrumbItem[];
  /** Separator between segments. Defaults to a `>` chevron. */
  separator?: ReactNode;
  className?: string;
}

/** A leaf asset (dashboard, dataset or chart) shown inside a folder. */
export interface FolderAsset {
  key: string;
  name: ReactNode;
  type: FolderAssetType;
}

/** A top-level entry in a {@link FolderList}, typically a folder of assets. */
export interface Folder {
  key: string;
  title: ReactNode;
  /**
   * Entry kind; controls the icon and whether the row is expandable (see
   * {@link FolderListProps.expandableTypes}). Defaults to `'folder'`.
   */
  type?: FolderItemType;
  assets: FolderAsset[];
}

export interface FolderListProps {
  folders: Folder[];
  /**
   * Entry types that expand in place to reveal their contents. A row whose
   * type is not listed renders as a single, non-collapsible row that calls
   * `onFolderClick` instead (e.g. to navigate into it). Defaults to `[]`, so
   * nothing is expandable unless a consumer opts a type in.
   */
  expandableTypes?: FolderItemType[];
  /** Keys of folders expanded on first render (expandable types only). */
  defaultActiveKeys?: string[];
  /** Only allow one folder open at a time. */
  accordion?: boolean;
  /** Show the asset-count badge next to each folder title. Defaults to `true`. */
  showCount?: boolean;
  /** Invoked when an asset row inside an expanded folder is clicked. */
  onAssetClick?: (asset: FolderAsset) => void;
  /**
   * Invoked when a non-expandable row is clicked, e.g. to open the folder or
   * asset's own page. Without a handler the row renders as an inert header.
   */
  onFolderClick?: (folder: Folder) => void;
  /**
   * Overrides the body shown when an expandable row is open. Receives the
   * entry and may branch on `folder.type`; return `undefined` to fall back to
   * the default asset list. Use it to render, say, a chart preview for an
   * expandable `dashboard` entry instead of a list of assets.
   */
  renderExpandedContent?: (folder: Folder) => ReactNode;
  className?: string;
}

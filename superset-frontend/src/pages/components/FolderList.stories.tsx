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
import { action } from 'storybook/actions';
import { FolderBreadcrumb } from './FolderBreadcrumb';
import { FolderList } from './FolderList';
import type {
  Folder,
  FolderAsset,
  FolderBreadcrumbItem,
  FolderListProps,
} from './types';

const sampleFolders: Folder[] = [
  {
    key: 'sales',
    title: 'Sales',
    assets: [
      { key: 'd1', name: 'Revenue Overview', type: 'dashboard' },
      { key: 'd2', name: 'Pipeline Health', type: 'dashboard' },
      { key: 'ds1', name: 'opportunities', type: 'dataset' },
    ],
  },
  {
    key: 'marketing',
    title: 'Marketing',
    assets: [
      { key: 'd3', name: 'Campaign Performance', type: 'dashboard' },
      { key: 'c1', name: 'Spend by Channel', type: 'chart' },
      { key: 'ds2', name: 'web_events', type: 'dataset' },
      { key: 'ds3', name: 'ad_spend', type: 'dataset' },
    ],
  },
  {
    key: 'product',
    title: 'Product',
    assets: [{ key: 'c2', name: 'Daily Active Users', type: 'chart' }],
  },
];

/**
 * A nested hierarchy for the drill-down story: top-level folders, each holding
 * dashboards, each dashboard holding its charts.
 */
const dashboardsByFolder: {
  key: string;
  title: string;
  dashboards: { key: string; title: string; charts: FolderAsset[] }[];
}[] = [
  {
    key: 'sales',
    title: 'Sales',
    dashboards: [
      {
        key: 'revenue',
        title: 'Revenue Overview',
        charts: [
          { key: 'mrr', name: 'MRR by month', type: 'chart' },
          { key: 'region', name: 'Revenue by region', type: 'chart' },
        ],
      },
      {
        key: 'pipeline',
        title: 'Pipeline Health',
        charts: [{ key: 'opps', name: 'Open opportunities', type: 'chart' }],
      },
    ],
  },
  {
    key: 'marketing',
    title: 'Marketing',
    dashboards: [
      {
        key: 'campaigns',
        title: 'Campaign Performance',
        charts: [
          { key: 'spend', name: 'Spend by channel', type: 'chart' },
          { key: 'conversions', name: 'Conversions', type: 'chart' },
        ],
      },
    ],
  },
];

export default {
  title: 'Components/Folders/FolderList',
  component: FolderList,
  parameters: {
    docs: {
      description: {
        component:
          'A list of folders. A row whose `type` is listed in `expandableTypes` ' +
          'is a Collapse panel that expands to reveal its assets (or any custom ' +
          'body supplied via `renderExpandedContent`). Any other row is a single, ' +
          'non-collapsible entry that calls `onFolderClick` instead — e.g. to ' +
          'navigate into its own page. With the default empty `expandableTypes`, ' +
          'nothing expands.',
      },
    },
  },
};

export const InteractiveFolderList = (args: FolderListProps) => (
  <FolderList {...args} />
);

InteractiveFolderList.args = {
  folders: sampleFolders,
  expandableTypes: ['folder'],
  defaultActiveKeys: ['sales'],
  accordion: false,
  showCount: true,
  onAssetClick: action('asset-click'),
  onFolderClick: action('folder-click'),
};

InteractiveFolderList.argTypes = {
  expandableTypes: {
    description:
      'Entry types that expand in place. Types left out render as a single ' +
      'row that fires onFolderClick instead.',
    control: 'check',
    options: ['folder', 'dashboard', 'dataset', 'chart'],
  },
  accordion: {
    description: 'Only allow a single folder to be open at a time.',
    control: 'boolean',
  },
  showCount: {
    description: 'Show the asset-count badge next to each folder title.',
    control: 'boolean',
  },
  defaultActiveKeys: {
    description: 'Keys of folders expanded on first render.',
    control: false,
  },
  folders: {
    description: 'Folders to render, each with its nested assets.',
    control: false,
  },
};

export const NavigableFolders = () => (
  <div>
    <FolderBreadcrumb
      items={[
        { key: 'root', title: 'All assets', onClick: action('navigate:root') },
        { key: 'analytics', title: 'Analytics' },
      ]}
    />
    <FolderList
      folders={sampleFolders}
      onFolderClick={action('navigate:folder')}
    />
  </div>
);

NavigableFolders.parameters = {
  controls: { disable: true },
  docs: {
    description: {
      story:
        'With an empty `expandableTypes`, folders do not expand; clicking a row ' +
        'fires `onFolderClick` to drill into it, tracked by the breadcrumb.',
    },
  },
};

export const CustomExpandedContent = () => (
  <FolderList
    folders={sampleFolders}
    expandableTypes={['folder']}
    defaultActiveKeys={['sales']}
    renderExpandedContent={folder => (
      <div style={{ padding: 12 }}>
        Custom body for <strong>{String(folder.title)}</strong> —{' '}
        {folder.assets.length} assets
      </div>
    )}
  />
);

CustomExpandedContent.parameters = {
  controls: { disable: true },
  docs: {
    description: {
      story:
        '`renderExpandedContent` replaces the default asset list with arbitrary ' +
        'content, e.g. a preview for an expandable dashboard entry.',
    },
  },
};

export const DrillIntoExpandableDashboards = () => {
  const [openFolder, setOpenFolder] = useState<string | null>(null);
  const folder = dashboardsByFolder.find(entry => entry.key === openFolder);

  const breadcrumbItems: FolderBreadcrumbItem[] = [
    { key: 'root', title: 'All assets', onClick: () => setOpenFolder(null) },
    ...(folder ? [{ key: folder.key, title: folder.title }] : []),
  ];

  // At the root we list folders, which navigate on click and extend the
  // breadcrumb. Inside a folder we list its dashboards — the only type in
  // `expandableTypes` — so each expands in place to reveal its charts.
  const folders: Folder[] = folder
    ? folder.dashboards.map(
        (dashboard): Folder => ({
          key: dashboard.key,
          title: dashboard.title,
          type: 'dashboard',
          assets: dashboard.charts,
        }),
      )
    : dashboardsByFolder.map(
        (entry): Folder => ({
          key: entry.key,
          title: entry.title,
          type: 'folder',
          assets: entry.dashboards.map(
            (dashboard): FolderAsset => ({
              key: dashboard.key,
              name: dashboard.title,
              type: 'dashboard',
            }),
          ),
        }),
      );

  return (
    <div>
      <FolderBreadcrumb items={breadcrumbItems} />
      <FolderList
        folders={folders}
        expandableTypes={['dashboard']}
        onFolderClick={({ key }) => setOpenFolder(key)}
        onAssetClick={action('open-chart')}
      />
    </div>
  );
};

DrillIntoExpandableDashboards.parameters = {
  controls: { disable: true },
  docs: {
    description: {
      story:
        'Only the `dashboard` type is expandable. At the root, folders are not ' +
        'expandable: clicking one drills in and extends the breadcrumb, whose ' +
        'segments are clickable to navigate back. Inside a folder, each ' +
        'dashboard expands in place to reveal its charts.',
    },
  },
};

export const WithBreadcrumb = () => (
  <div>
    <FolderBreadcrumb
      items={[
        { key: 'root', title: 'All assets', onClick: action('navigate:root') },
        { key: 'analytics', title: 'Analytics' },
      ]}
    />
    <FolderList
      folders={sampleFolders}
      expandableTypes={['folder']}
      defaultActiveKeys={['sales', 'marketing']}
      onAssetClick={action('asset-click')}
    />
  </div>
);

WithBreadcrumb.parameters = {
  controls: { disable: true },
  docs: {
    description: {
      story:
        'Breadcrumb and folder list composed together, as they appear on an ' +
        'analytics listing page.',
    },
  },
};

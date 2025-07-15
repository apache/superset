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

import React from 'react';
import {
  useActivePlugin,
  useDocsVersion,
  useVersions,
} from '@docusaurus/plugin-content-docs/client';
import { useLocation } from '@docusaurus/router';
import { useDocsPreferredVersion } from '@docusaurus/theme-common';
import { Dropdown } from 'antd';
import { DownOutlined } from '@ant-design/icons';

import styles from './styles.module.css';

export default function DocVersionBadge() {
  const activePlugin = useActivePlugin();
  const { pathname } = useLocation();
  const pluginId = activePlugin?.pluginId;
  const [versionedPath, setVersionedPath] = React.useState('');

  // Only show version selector for docs, components, tutorials, and developer_portal
  const isVersioned = [
    'default',
    'components',
    'tutorials',
    'developer_portal',
  ].includes(pluginId);

  const { preferredVersion } = useDocsPreferredVersion(pluginId);
  const versions = useVersions(pluginId);
  const version = useDocsVersion();

  // Extract the current page path relative to the version
  React.useEffect(() => {
    if (!pathname || !version || !pluginId) return;

    let relativePath = '';

    // Handle different version path patterns
    if (pathname.includes(`/${pluginId}/`)) {
      // Extract the part after the version
      // Example: /components/1.1.0/ui-components/button -> /ui-components/button
      const parts = pathname.split(`/${pluginId}/`);
      if (parts.length > 1) {
        const afterPluginId = parts[1];
        // Find where the version part ends
        const versionParts = afterPluginId.split('/');
        if (versionParts.length > 1) {
          // Remove the version part and join the rest
          relativePath = '/' + versionParts.slice(1).join('/');
        }
      }
    }

    setVersionedPath(relativePath);
  }, [pathname, version, pluginId]);

  // Create dropdown items for version selection
  const items = versions.map(v => {
    // Construct the URL for this version, preserving the current page
    // v.path is the version-specific path like "1.0.0" or "next"
    let versionUrl = v.path;

    if (versionedPath) {
      // Construct the full URL with the version and the current page path
      versionUrl = v.path + versionedPath;
    }

    return {
      key: v.name,
      label: (
        <a href={versionUrl}>
          {v.label}
          {v.name === version.name && ' (current)'}
          {v.name === preferredVersion?.name && ' (preferred)'}
        </a>
      ),
    };
  });

  if (!isVersioned) {
    return null;
  }

  return (
    <span className={styles.versionBadge}>
      Version:{' '}
      <Dropdown menu={{ items }} trigger={['click']}>
        <a onClick={e => e.preventDefault()} className={styles.versionSelector}>
          {version.label} <DownOutlined />
        </a>
      </Dropdown>
    </span>
  );
}

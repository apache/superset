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

  // Show version selector for all versioned sections
  const isVersioned = [
    'default',  // main docs
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
    const basePath = pluginId === 'default' ? '/docs' : `/${pluginId}`;

    // Handle different version path patterns
    if (pathname.includes(basePath)) {
      // Extract the part after the base path
      const parts = pathname.split(basePath);
      if (parts.length > 1) {
        const afterBase = parts[1];
        // For versioned paths, remove the version segment
        if (afterBase.startsWith('/')) {
          const segments = afterBase.substring(1).split('/');
          // Check if first segment is a version (e.g., "1.1.0", "next")
          if (segments[0] && (segments[0].match(/^\d+\.\d+\.\d+$/) || segments[0] === 'next')) {
            // Skip the version segment
            relativePath = segments.length > 1 ? '/' + segments.slice(1).join('/') : '';
          } else {
            // No version in path (e.g., /docs/intro for current version with empty path)
            relativePath = afterBase;
          }
        }
      }
    }

    setVersionedPath(relativePath);
  }, [pathname, version, pluginId]);

  // Create dropdown items for version selection
  const items = versions.map(v => {
    // Construct the URL for this version, preserving the current page
    // v.path contains the full path including base, e.g., "/docs/1.1.0" or "/docs"
    let versionUrl = v.path;

    if (versionedPath) {
      // Append the current page path to the version base
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

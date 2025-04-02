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
import DocVersionBanner from '@theme-original/DocVersionBanner';
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

export default function DocVersionBannerWrapper(props) {
  const activePlugin = useActivePlugin();
  const { pathname } = useLocation();
  const pluginId = activePlugin?.pluginId;

  // Only show version selector for docs, components, and tutorials
  const isVersioned = ['default', 'components', 'tutorials'].includes(pluginId);

  const { preferredVersion } = useDocsPreferredVersion(pluginId);
  const versions = useVersions(pluginId);
  const version = useDocsVersion();

  // Create dropdown items for version selection
  const items = versions.map(v => ({
    key: v.name,
    label: (
      <a href={v.path}>
        {v.label}
        {v.name === version.name && ' (current)'}
      </a>
    ),
  }));

  return (
    <>
      <DocVersionBanner {...props} />
      {isVersioned && (
        <div className={styles.versionBanner}>
          <div className={styles.versionContainer}>
            <span className={styles.versionLabel}>Version:</span>
            <Dropdown menu={{ items }} trigger={['click']}>
              <a
                onClick={e => e.preventDefault()}
                className={styles.versionSelector}
              >
                {version.label} <DownOutlined />
              </a>
            </Dropdown>
          </div>
        </div>
      )}
    </>
  );
}

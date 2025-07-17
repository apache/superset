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

import React, { useState } from 'react';
import configMetadata from '../resources/config_metadata.json';

interface EnvironmentVariablesExampleProps {
  category?: string;
}

const EnvironmentVariablesExample: React.FC<
  EnvironmentVariablesExampleProps
> = ({ category }) => {
  const [showAll, setShowAll] = useState(false);

  // Get settings based on category
  const getSettings = () => {
    if (category && configMetadata.by_category[category]) {
      return configMetadata.by_category[category];
    }
    return configMetadata.all_settings;
  };

  const settings = getSettings();
  const displaySettings = showAll ? settings : settings.slice(0, 5);

  const formatDefaultForEnv = (value: any): string => {
    if (value === null || value === undefined) return '""';
    if (typeof value === 'object') {
      return `'${JSON.stringify(value)}'`;
    }
    if (typeof value === 'string') {
      return `"${value}"`;
    }
    return String(value);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const generateEnvExample = (setting: any): string => {
    const example = formatDefaultForEnv(setting.default);
    return `export ${setting.env_var}=${example}`;
  };

  const generateAllEnvVars = (): string => {
    return [
      '# Superset Configuration Environment Variables',
      '# Generated from configuration metadata',
      '',
      ...displaySettings.map(setting =>
        [
          `# ${setting.title}`,
          `# ${setting.description}`,
          `# Type: ${setting.type}`,
          `# Impact: ${setting.impact}${
            setting.requires_restart ? ' (requires restart)' : ''
          }`,
          generateEnvExample(setting),
          '',
        ].join('\n'),
      ),
    ].join('\n');
  };

  return (
    <div style={{ margin: '20px 0' }}>
      <div
        style={{
          backgroundColor: '#f6f8fa',
          border: '1px solid #e1e4e8',
          borderRadius: '6px',
          padding: '16px',
          position: 'relative',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '10px',
          }}
        >
          <h4 style={{ margin: 0, color: '#24292e' }}>
            Environment Variables {category && `(${category})`}
          </h4>
          <button
            onClick={() => copyToClipboard(generateAllEnvVars())}
            style={{
              backgroundColor: '#0366d6',
              color: 'white',
              border: 'none',
              padding: '6px 12px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
            }}
            title="Copy all environment variables"
          >
            📋 Copy All
          </button>
        </div>

        <pre
          style={{
            backgroundColor: '#f6f8fa',
            border: 'none',
            padding: '0',
            margin: '0',
            fontFamily:
              'SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace',
            fontSize: '12px',
            lineHeight: '1.45',
            overflow: 'auto',
            maxHeight: '400px',
          }}
        >
          <code>{generateAllEnvVars()}</code>
        </pre>

        {!showAll && settings.length > 5 && (
          <div
            style={{
              textAlign: 'center',
              marginTop: '10px',
              borderTop: '1px solid #e1e4e8',
              paddingTop: '10px',
            }}
          >
            <button
              onClick={() => setShowAll(true)}
              style={{
                backgroundColor: 'transparent',
                border: '1px solid #0366d6',
                color: '#0366d6',
                padding: '6px 12px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              Show all {settings.length} settings
            </button>
          </div>
        )}
      </div>

      <div
        style={{
          marginTop: '10px',
          fontSize: '14px',
          color: '#586069',
        }}
      >
        <strong>Usage:</strong> Save to a <code>.env</code> file or export
        directly in your shell.
        {category && ` Showing ${settings.length} ${category} settings.`}
      </div>
    </div>
  );
};

export default EnvironmentVariablesExample;

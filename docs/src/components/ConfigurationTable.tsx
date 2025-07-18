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

interface ConfigSetting {
  key: string;
  title: string;
  description: string;
  type: string;
  category: string;
  impact: string;
  requires_restart: boolean;
  default: any;
  env_var: string;
  nested_example: string | null;
  documentation_url: string | null;
}

interface ConfigurationTableProps {
  category?: string;
  showEnvironmentVariables?: boolean;
}

const ImpactBadge: React.FC<{ impact: string }> = ({ impact }) => {
  const colors = {
    low: '#52c41a',
    medium: '#faad14',
    high: '#ff4d4f',
  };

  return (
    <span
      style={{
        backgroundColor: colors[impact] || '#d9d9d9',
        color: 'white',
        padding: '1px 6px',
        borderRadius: '3px',
        fontSize: '10px',
        fontWeight: 'bold',
      }}
    >
      {impact.toUpperCase()}
    </span>
  );
};

const RestartBadge: React.FC<{ requiresRestart: boolean }> = ({
  requiresRestart,
}) => {
  if (!requiresRestart) return null;

  return (
    <span
      style={{
        backgroundColor: '#ff7875',
        color: 'white',
        padding: '1px 6px',
        borderRadius: '3px',
        fontSize: '10px',
        fontWeight: 'bold',
        marginLeft: '6px',
      }}
    >
      RESTART
    </span>
  );
};

const ConfigurationTable: React.FC<ConfigurationTableProps> = ({
  category,
  showEnvironmentVariables = false,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>(
    category || 'all',
  );
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Get settings based on selected category
  const getSettings = (): ConfigSetting[] => {
    if (selectedCategory === 'all') {
      return configMetadata.all_settings;
    }
    return configMetadata.by_category[selectedCategory] || [];
  };

  // Filter settings based on search term
  const filteredSettings = getSettings().filter(setting => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      setting.key.toLowerCase().includes(searchLower) ||
      setting.description.toLowerCase().includes(searchLower)
    );
  });

  const settings = filteredSettings;

  const formatDefault = (value: any): string => {
    if (value === null || value === undefined) return 'None';
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div style={{ margin: '20px 0' }}>
      {/* Search and Category controls */}
      <div
        style={{
          marginBottom: '20px',
          display: 'flex',
          gap: '15px',
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        {/* Search input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontWeight: 'bold', fontSize: '14px' }}>
            Search:
          </label>
          <input
            type="text"
            placeholder="Filter by name or description..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{
              padding: '6px 10px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '14px',
              minWidth: '250px',
            }}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '16px',
                color: '#666',
                padding: '2px',
              }}
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        {/* Category selector */}
        {!category && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontWeight: 'bold', fontSize: '14px' }}>
              Category:
            </label>
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              style={{
                padding: '6px 10px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px',
              }}
            >
              <option value="all">All Categories</option>
              {configMetadata.categories.map(cat => (
                <option key={cat} value={cat}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Results count */}
        <span style={{ fontSize: '14px', color: '#666', marginLeft: 'auto' }}>
          {searchTerm
            ? `Found ${settings.length} matching settings`
            : `Showing ${settings.length} configuration settings`}
        </span>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            border: '1px solid #ddd',
          }}
        >
          <thead>
            <tr style={{ backgroundColor: '#f5f5f5' }}>
              <th
                style={{
                  padding: '8px',
                  border: '1px solid #ddd',
                  textAlign: 'left',
                  fontSize: '13px',
                  fontWeight: 'bold',
                }}
              >
                Setting
              </th>
              <th
                style={{
                  padding: '8px',
                  border: '1px solid #ddd',
                  textAlign: 'left',
                  fontSize: '13px',
                  fontWeight: 'bold',
                }}
              >
                Description
              </th>
              <th
                style={{
                  padding: '8px',
                  border: '1px solid #ddd',
                  textAlign: 'left',
                  fontSize: '13px',
                  fontWeight: 'bold',
                }}
              >
                Type
              </th>
              <th
                style={{
                  padding: '8px',
                  border: '1px solid #ddd',
                  textAlign: 'left',
                  fontSize: '13px',
                  fontWeight: 'bold',
                }}
              >
                Default
              </th>
              {showEnvironmentVariables && (
                <th
                  style={{
                    padding: '8px',
                    border: '1px solid #ddd',
                    textAlign: 'left',
                    fontSize: '13px',
                    fontWeight: 'bold',
                  }}
                >
                  Environment Variable
                </th>
              )}
              <th
                style={{
                  padding: '8px',
                  border: '1px solid #ddd',
                  textAlign: 'left',
                  fontSize: '13px',
                  fontWeight: 'bold',
                }}
              >
                Impact
              </th>
            </tr>
          </thead>
          <tbody>
            {settings.map((setting: ConfigSetting) => (
              <tr key={setting.key}>
                <td
                  style={{
                    padding: '8px',
                    border: '1px solid #ddd',
                    verticalAlign: 'top',
                    fontSize: '13px',
                  }}
                >
                  <div>
                    <code style={{ fontSize: '13px', fontWeight: 'bold' }}>
                      {setting.key}
                    </code>
                    {setting.documentation_url && (
                      <div style={{ marginTop: '2px' }}>
                        <a
                          href={setting.documentation_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: '11px' }}
                        >
                          📖 Docs
                        </a>
                      </div>
                    )}
                  </div>
                </td>
                <td
                  style={{
                    padding: '8px',
                    border: '1px solid #ddd',
                    verticalAlign: 'top',
                    fontSize: '12px',
                  }}
                >
                  {setting.description}
                </td>
                <td
                  style={{
                    padding: '8px',
                    border: '1px solid #ddd',
                    verticalAlign: 'top',
                    fontSize: '12px',
                  }}
                >
                  <code style={{ fontSize: '12px' }}>{setting.type}</code>
                </td>
                <td
                  style={{
                    padding: '8px',
                    border: '1px solid #ddd',
                    verticalAlign: 'top',
                    fontSize: '12px',
                  }}
                >
                  <code style={{ fontSize: '11px' }}>
                    {formatDefault(setting.default)}
                  </code>
                </td>
                {showEnvironmentVariables && (
                  <td
                    style={{
                      padding: '8px',
                      border: '1px solid #ddd',
                      verticalAlign: 'top',
                      fontSize: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <code style={{ fontSize: '11px', marginRight: '6px' }}>
                        {setting.env_var}
                      </code>
                      <button
                        onClick={() => copyToClipboard(setting.env_var)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '11px',
                          color: '#1890ff',
                        }}
                        title="Copy to clipboard"
                      >
                        📋
                      </button>
                    </div>
                    {setting.nested_example && (
                      <div style={{ marginTop: '2px' }}>
                        <code style={{ fontSize: '10px', color: '#666' }}>
                          {setting.nested_example}
                        </code>
                      </div>
                    )}
                  </td>
                )}
                <td
                  style={{
                    padding: '8px',
                    border: '1px solid #ddd',
                    verticalAlign: 'top',
                    fontSize: '12px',
                  }}
                >
                  <ImpactBadge impact={setting.impact} />
                  <RestartBadge requiresRestart={setting.requires_restart} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {settings.length === 0 && (
        <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
          {searchTerm ? (
            <div>
              <p>
                No configuration settings found matching &quot;{searchTerm}
                &quot;.
              </p>
              <p style={{ fontSize: '14px', marginTop: '10px' }}>
                Try adjusting your search term or{' '}
                <button
                  onClick={() => setSearchTerm('')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#1890ff',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    fontSize: '14px',
                  }}
                >
                  clear the search
                </button>
                .
              </p>
            </div>
          ) : (
            'No configuration settings found for the selected category.'
          )}
        </div>
      )}
    </div>
  );
};

export default ConfigurationTable;

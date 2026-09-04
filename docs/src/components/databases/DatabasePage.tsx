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
  Card,
  Collapse,
  Table,
  Tag,
  Typography,
  Alert,
  Space,
  Divider,
  Tabs,
} from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
  LinkOutlined,
  KeyOutlined,
  SettingOutlined,
  BookOutlined,
  EditOutlined,
  GithubOutlined,
  BugOutlined,
} from '@ant-design/icons';
import type { DatabaseInfo } from './types';

// Simple code block component for connection strings
const CodeBlock: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <pre
    style={{
      background: 'var(--ifm-code-background)',
      padding: '12px 16px',
      borderRadius: '4px',
      overflow: 'auto',
      fontSize: '13px',
      fontFamily: 'var(--ifm-font-family-monospace)',
    }}
  >
    <code>{children}</code>
  </pre>
);

const { Title, Paragraph, Text } = Typography;

interface DatabasePageProps {
  database: DatabaseInfo;
  name: string;
}

// Feature badge component
const FeatureBadge: React.FC<{ supported: boolean; label: string }> = ({
  supported,
  label,
}) => (
  <Tag
    icon={supported ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
    color={supported ? 'success' : 'default'}
  >
    {label}
  </Tag>
);

// Time grain badge
const TimeGrainBadge: React.FC<{ supported: boolean; grain: string }> = ({
  supported,
  grain,
}) => (
  <Tag color={supported ? 'blue' : 'default'} style={{ margin: '2px' }}>
    {grain}
  </Tag>
);

const DatabasePage: React.FC<DatabasePageProps> = ({ database, name }) => {
  const { documentation: docs } = database;

  // Helper to render connection string with copy button
  const renderConnectionString = (connStr: string, description?: string) => (
    <div style={{ marginBottom: 16 }}>
      {description && (
        <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>
          {description}
        </Text>
      )}
      <CodeBlock>{connStr}</CodeBlock>
    </div>
  );

  // Ensure db filename can be obtained regardless of how db doc gets generated
  // by either Flask app (superset.db_engine_specs.postgres) or fallback mode (postgres)
  const databaseModuleFilename = `${database.module?.split('.').pop()}.py`;

  // Render driver information
  const renderDrivers = () => {
    if (!docs?.drivers?.length) return null;

    return (
      <Card title="Drivers" style={{ marginBottom: 16 }}>
        <Tabs
          items={docs.drivers.map((driver, idx) => ({
            key: String(idx),
            label: (
              <span>
                {driver.name}
                {driver.is_recommended && (
                  <Tag color="green" style={{ marginLeft: 8 }}>
                    Recommended
                  </Tag>
                )}
              </span>
            ),
            children: (
              <Space direction="vertical" style={{ width: '100%' }}>
                {driver.pypi_package && (
                  <div>
                    <Text strong>PyPI Package: </Text>
                    <code>{driver.pypi_package}</code>
                  </div>
                )}
                {driver.connection_string &&
                  renderConnectionString(driver.connection_string)}
                {driver.notes && (
                  <Alert message={driver.notes} type="info" showIcon />
                )}
                {driver.docs_url && (
                  <a href={driver.docs_url} target="_blank" rel="noreferrer">
                    <LinkOutlined /> Documentation
                  </a>
                )}
              </Space>
            ),
          }))}
        />
      </Card>
    );
  };

  // Render authentication methods
  const renderAuthMethods = () => {
    if (!docs?.authentication_methods?.length) return null;

    return (
      <Card
        title={
          <>
            <KeyOutlined /> Authentication Methods
          </>
        }
        style={{ marginBottom: 16 }}
      >
        <Collapse
          accordion
          items={docs.authentication_methods.map((auth, idx) => ({
            key: String(idx),
            label: auth.name,
            children: (
              <>
                {auth.description && <Paragraph>{auth.description}</Paragraph>}
                {auth.requirements && (
                  <Alert
                    message="Requirements"
                    description={auth.requirements}
                    type="warning"
                    showIcon
                    style={{ marginBottom: 16 }}
                  />
                )}
                {auth.connection_string &&
                  renderConnectionString(
                    auth.connection_string,
                    'Connection String',
                  )}
                {auth.secure_extra && (
                  <div>
                    <Text strong>Secure Extra Configuration:</Text>
                    <CodeBlock>
                      {JSON.stringify(auth.secure_extra, null, 2)}
                    </CodeBlock>
                  </div>
                )}
                {auth.engine_parameters && (
                  <div>
                    <Text strong>Engine Parameters:</Text>
                    <CodeBlock>
                      {JSON.stringify(auth.engine_parameters, null, 2)}
                    </CodeBlock>
                  </div>
                )}
                {auth.notes && (
                  <Alert message={auth.notes} type="info" showIcon />
                )}
              </>
            ),
          }))}
        />
      </Card>
    );
  };

  // Render engine parameters
  const renderEngineParams = () => {
    if (!docs?.engine_parameters?.length) return null;

    return (
      <Card
        title={
          <>
            <SettingOutlined /> Engine Parameters
          </>
        }
        style={{ marginBottom: 16 }}
      >
        <Collapse
          items={docs.engine_parameters.map((param, idx) => ({
            key: String(idx),
            label: param.name,
            children: (
              <>
                {param.description && (
                  <Paragraph>{param.description}</Paragraph>
                )}
                {param.json && (
                  <CodeBlock>{JSON.stringify(param.json, null, 2)}</CodeBlock>
                )}
                {param.docs_url && (
                  <a href={param.docs_url} target="_blank" rel="noreferrer">
                    <LinkOutlined /> Learn more
                  </a>
                )}
              </>
            ),
          }))}
        />
      </Card>
    );
  };

  // Render compatible databases (for PostgreSQL, etc.)
  const renderCompatibleDatabases = () => {
    if (!docs?.compatible_databases?.length) return null;

    // Create array of all item keys to expand by default
    const allItemKeys = docs.compatible_databases.map((_, idx) => String(idx));

    return (
      <Card title="Compatible Databases" style={{ marginBottom: 16 }}>
        <Paragraph>
          The following databases are compatible with the {name} driver:
        </Paragraph>
        <Collapse
          defaultActiveKey={allItemKeys}
          items={docs.compatible_databases.map((compat, idx) => ({
            key: String(idx),
            label: (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {compat.logo && (
                  <img
                    src={`/img/databases/${compat.logo}`}
                    alt={compat.name}
                    style={{
                      width: 28,
                      height: 28,
                      objectFit: 'contain',
                    }}
                  />
                )}
                <span>{compat.name}</span>
              </div>
            ),
            children: (
              <>
                {compat.description && (
                  <Paragraph>{compat.description}</Paragraph>
                )}
                {compat.connection_string &&
                  renderConnectionString(compat.connection_string)}
                {compat.parameters && (
                  <div>
                    <Text strong>Parameters:</Text>
                    <Table
                      dataSource={Object.entries(compat.parameters).map(
                        ([key, value]) => ({
                          key,
                          parameter: key,
                          description: value,
                        }),
                      )}
                      columns={[
                        {
                          title: 'Parameter',
                          dataIndex: 'parameter',
                          key: 'p',
                        },
                        {
                          title: 'Description',
                          dataIndex: 'description',
                          key: 'd',
                        },
                      ]}
                      pagination={false}
                      size="small"
                    />
                  </div>
                )}
                {compat.notes && (
                  <Alert
                    message={compat.notes}
                    type="info"
                    showIcon
                    style={{ marginTop: 16 }}
                  />
                )}
              </>
            ),
          }))}
        />
      </Card>
    );
  };

  // Render feature matrix
  const renderFeatures = () => {
    const features: Array<{ key: keyof DatabaseInfo; label: string }> = [
      { key: 'joins', label: 'JOINs' },
      { key: 'subqueries', label: 'Subqueries' },
      { key: 'supports_dynamic_schema', label: 'Dynamic Schema' },
      { key: 'supports_catalog', label: 'Catalog Support' },
      { key: 'supports_dynamic_catalog', label: 'Dynamic Catalog' },
      { key: 'ssh_tunneling', label: 'SSH Tunneling' },
      { key: 'query_cancelation', label: 'Query Cancellation' },
      { key: 'supports_file_upload', label: 'File Upload' },
      { key: 'user_impersonation', label: 'User Impersonation' },
      { key: 'query_cost_estimation', label: 'Cost Estimation' },
      { key: 'sql_validation', label: 'SQL Validation' },
    ];

    return (
      <Card title="Supported Features" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {features.map(({ key, label }) => (
            <FeatureBadge
              key={key}
              supported={Boolean(database[key])}
              label={label}
            />
          ))}
        </div>
        {database.score > 0 && (
          <div style={{ marginTop: 16 }}>
            <Text>
              Feature Score:{' '}
              <Text strong>
                {database.score}/{database.max_score}
              </Text>
            </Text>
          </div>
        )}
      </Card>
    );
  };

  // Render time grains
  const renderTimeGrains = () => {
    if (!database.time_grains) return null;

    const commonGrains = [
      'SECOND',
      'MINUTE',
      'HOUR',
      'DAY',
      'WEEK',
      'MONTH',
      'QUARTER',
      'YEAR',
    ];
    const extendedGrains = Object.keys(database.time_grains).filter(
      g => !commonGrains.includes(g),
    );

    return (
      <Card title="Time Grains" style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 16 }}>
          <Text strong>Common Time Grains:</Text>
          <div style={{ marginTop: 8 }}>
            {commonGrains.map(grain => (
              <TimeGrainBadge
                key={grain}
                grain={grain}
                supported={Boolean(
                  database.time_grains[
                    grain as keyof typeof database.time_grains
                  ],
                )}
              />
            ))}
          </div>
        </div>
        {extendedGrains.length > 0 && (
          <div>
            <Text strong>Extended Time Grains:</Text>
            <div style={{ marginTop: 8 }}>
              {extendedGrains.map(grain => (
                <TimeGrainBadge
                  key={grain}
                  grain={grain}
                  supported={Boolean(
                    database.time_grains[
                      grain as keyof typeof database.time_grains
                    ],
                  )}
                />
              ))}
            </div>
          </div>
        )}
      </Card>
    );
  };

  // Render troubleshooting / custom errors section
  const renderTroubleshooting = () => {
    if (!docs?.custom_errors?.length) return null;

    // Group errors by category
    const errorsByCategory: Record<string, typeof docs.custom_errors> = {};
    for (const error of docs.custom_errors) {
      const category = error.category || 'General';
      if (!errorsByCategory[category]) {
        errorsByCategory[category] = [];
      }
      errorsByCategory[category].push(error);
    }

    // Define category order for consistent display
    const categoryOrder = [
      'Authentication',
      'Connection',
      'Permissions',
      'Query',
      'Configuration',
      'General',
    ];

    const sortedCategories = Object.keys(errorsByCategory).sort((a, b) => {
      const aIdx = categoryOrder.indexOf(a);
      const bIdx = categoryOrder.indexOf(b);
      if (aIdx === -1 && bIdx === -1) return a.localeCompare(b);
      if (aIdx === -1) return 1;
      if (bIdx === -1) return -1;
      return aIdx - bIdx;
    });

    // Category colors
    const categoryColors: Record<string, string> = {
      Authentication: 'orange',
      Connection: 'red',
      Permissions: 'purple',
      Query: 'blue',
      Configuration: 'cyan',
      General: 'default',
    };

    return (
      <Card
        title={
          <>
            <BugOutlined /> Troubleshooting
          </>
        }
        style={{ marginBottom: 16 }}
      >
        <Paragraph type="secondary">
          Common error messages you may encounter when connecting to or querying{' '}
          {name}, along with their causes and solutions.
        </Paragraph>
        <Collapse
          accordion
          items={sortedCategories.map(category => ({
            key: category,
            label: (
              <span>
                <Tag color={categoryColors[category] || 'default'}>
                  {category}
                </Tag>
                {errorsByCategory[category].length} error
                {errorsByCategory[category].length !== 1 ? 's' : ''}
              </span>
            ),
            children: (
              <>
                {errorsByCategory[category].map((error, idx) => (
                  <div
                    key={idx}
                    style={{
                      marginBottom:
                        idx < errorsByCategory[category].length - 1 ? 16 : 0,
                      paddingBottom:
                        idx < errorsByCategory[category].length - 1 ? 16 : 0,
                      borderBottom:
                        idx < errorsByCategory[category].length - 1
                          ? '1px solid var(--ifm-color-emphasis-200)'
                          : 'none',
                    }}
                  >
                    <div style={{ marginBottom: 8 }}>
                      <Text strong>
                        {error.description || error.error_type}
                      </Text>
                    </div>
                    <Alert
                      message={error.message_template}
                      type="error"
                      style={{ marginBottom: 8 }}
                    />
                    {error.invalid_fields &&
                      error.invalid_fields.length > 0 && (
                        <div style={{ marginBottom: 8 }}>
                          <Text type="secondary">Check these fields: </Text>
                          {error.invalid_fields.map(field => (
                            <Tag key={field} color="warning">
                              {field}
                            </Tag>
                          ))}
                        </div>
                      )}
                    {error.issue_codes && error.issue_codes.length > 0 && (
                      <div>
                        <Text type="secondary">Related issue codes: </Text>
                        {error.issue_codes.map(code => (
                          <Tag key={code}>
                            <a
                              href={`/docs/using-superset/issue-codes#issue-${code}`}
                              style={{ color: 'inherit' }}
                            >
                              Issue {code}
                            </a>
                          </Tag>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </>
            ),
          }))}
        />
      </Card>
    );
  };

  return (
    <div className="database-page" id={name.toLowerCase().replace(/\s+/g, '-')}>
      <div style={{ marginBottom: 16 }}>
        {docs?.logo && (
          <img
            src={`/img/databases/${docs.logo}`}
            alt={name}
            style={{
              height: 120,
              objectFit: 'contain',
              marginBottom: 12,
            }}
          />
        )}
        <Title level={1} style={{ margin: 0 }}>
          {name}
        </Title>
        {docs?.homepage_url && (
          <a
            href={docs.homepage_url}
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: 14 }}
          >
            <LinkOutlined /> {docs.homepage_url}
          </a>
        )}
      </div>

      {docs?.description && <Paragraph>{docs.description}</Paragraph>}

      {/* Warnings */}
      {docs?.warnings?.map((warning, idx) => (
        <Alert
          key={idx}
          message={warning}
          type="warning"
          icon={<WarningOutlined />}
          showIcon
          style={{ marginBottom: 16 }}
        />
      ))}

      {/* Known Limitations */}
      {docs?.limitations?.length > 0 && (
        <Card
          title="Known Limitations"
          style={{ marginBottom: 16 }}
          type="inner"
        >
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {docs.limitations.map((limitation, idx) => (
              <li key={idx}>{limitation}</li>
            ))}
          </ul>
        </Card>
      )}

      {/* Installation */}
      {(docs?.pypi_packages?.length || docs?.install_instructions) && (
        <Card title="Installation" style={{ marginBottom: 16 }}>
          {docs.pypi_packages?.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <Text strong>Required packages: </Text>
              {docs.pypi_packages.map(pkg => (
                <Tag key={pkg} color="blue">
                  {pkg}
                </Tag>
              ))}
            </div>
          )}
          {docs.version_requirements && (
            <Alert
              message={`Version requirement: ${docs.version_requirements}`}
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}
          {docs.install_instructions && (
            <CodeBlock>{docs.install_instructions}</CodeBlock>
          )}
        </Card>
      )}

      {/* Basic Connection */}
      {docs?.connection_string && !docs?.drivers?.length && (
        <Card title="Connection String" style={{ marginBottom: 16 }}>
          {renderConnectionString(docs.connection_string)}
          {docs.parameters && (
            <Table
              dataSource={Object.entries(docs.parameters).map(
                ([key, value]) => ({
                  key,
                  parameter: key,
                  description: value,
                }),
              )}
              columns={[
                { title: 'Parameter', dataIndex: 'parameter', key: 'p' },
                { title: 'Description', dataIndex: 'description', key: 'd' },
              ]}
              pagination={false}
              size="small"
            />
          )}
          {docs.default_port && (
            <Text type="secondary">Default port: {docs.default_port}</Text>
          )}
        </Card>
      )}

      {/* Drivers */}
      {renderDrivers()}

      {/* Connection Examples */}
      {docs?.connection_examples?.length > 0 && (
        <Card title="Connection Examples" style={{ marginBottom: 16 }}>
          {docs.connection_examples.map((example, idx) => (
            <div key={idx}>
              {renderConnectionString(
                example.connection_string,
                example.description,
              )}
            </div>
          ))}
        </Card>
      )}

      {/* Authentication Methods */}
      {renderAuthMethods()}

      {/* Engine Parameters */}
      {renderEngineParams()}

      {/* Features */}
      {renderFeatures()}

      {/* Time Grains */}
      {renderTimeGrains()}

      {/* Troubleshooting / Custom Errors */}
      {renderTroubleshooting()}

      {/* Compatible Databases */}
      {renderCompatibleDatabases()}

      {/* Notes */}
      {docs?.notes && (
        <Alert
          message="Notes"
          description={docs.notes}
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {/* External Links */}
      {(docs?.docs_url || docs?.tutorials?.length) && (
        <Card
          title={
            <>
              <BookOutlined /> Resources
            </>
          }
          style={{ marginBottom: 16 }}
        >
          <Space direction="vertical">
            {docs.docs_url && (
              <a href={docs.docs_url} target="_blank" rel="noreferrer">
                <LinkOutlined /> Official Documentation
              </a>
            )}
            {docs.sqlalchemy_docs_url && (
              <a
                href={docs.sqlalchemy_docs_url}
                target="_blank"
                rel="noreferrer"
              >
                <LinkOutlined /> SQLAlchemy Dialect Documentation
              </a>
            )}
            {docs.tutorials?.map((tutorial, idx) => (
              <a key={idx} href={tutorial} target="_blank" rel="noreferrer">
                <LinkOutlined /> Tutorial {idx + 1}
              </a>
            ))}
          </Space>
        </Card>
      )}

      {/* Edit link */}
      {database.module && (
        <Card
          style={{
            marginBottom: 16,
            background: 'var(--ifm-background-surface-color)',
            borderStyle: 'dashed',
          }}
          size="small"
        >
          <Space>
            <GithubOutlined />
            <Text type="secondary">
              Help improve this documentation by editing the engine spec:
            </Text>
            <a
              href={`https://github.com/apache/superset/edit/master/superset/db_engine_specs/${databaseModuleFilename}`}
              target="_blank"
              rel="noreferrer"
            >
              <EditOutlined /> Edit {databaseModuleFilename}
            </a>
          </Space>
        </Card>
      )}

      <Divider />
    </div>
  );
};

export default DatabasePage;

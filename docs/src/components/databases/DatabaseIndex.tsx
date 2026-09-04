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

import React, { useState, useMemo } from 'react';
import { Card, Row, Col, Statistic, Table, Tag, Input, Select, Tooltip } from 'antd';
import {
  DatabaseOutlined,
  CheckCircleOutlined,
  ApiOutlined,
  KeyOutlined,
  SearchOutlined,
  LinkOutlined,
  BugOutlined,
} from '@ant-design/icons';
import type { DatabaseData, DatabaseInfo, TimeGrains } from './types';

interface DatabaseIndexProps {
  data: DatabaseData;
}

// Type for table entries (includes both regular DBs and compatible DBs)
interface TableEntry {
  name: string;
  categories: string[];  // Multiple categories supported
  score: number;
  max_score: number;
  timeGrainCount: number;
  time_grains?: TimeGrains;
  hasDrivers: boolean;
  hasAuthMethods: boolean;
  hasConnectionString: boolean;
  hasCustomErrors: boolean;
  customErrorCount: number;
  joins?: boolean;
  subqueries?: boolean;
  supports_dynamic_schema?: boolean;
  supports_catalog?: boolean;
  ssh_tunneling?: boolean;
  supports_file_upload?: boolean;
  query_cancelation?: boolean;
  query_cost_estimation?: boolean;
  user_impersonation?: boolean;
  sql_validation?: boolean;
  documentation?: DatabaseInfo['documentation'];
  // For compatible databases
  isCompatible?: boolean;
  compatibleWith?: string;
  compatibleDescription?: string;
}

// Map category constant names to display names
const CATEGORY_DISPLAY_NAMES: Record<string, string> = {
  'CLOUD_AWS': 'Cloud - AWS',
  'CLOUD_GCP': 'Cloud - Google',
  'CLOUD_AZURE': 'Cloud - Azure',
  'CLOUD_DATA_WAREHOUSES': 'Cloud Data Warehouses',
  'APACHE_PROJECTS': 'Apache Projects',
  'TRADITIONAL_RDBMS': 'Traditional RDBMS',
  'ANALYTICAL_DATABASES': 'Analytical Databases',
  'SEARCH_NOSQL': 'Search & NoSQL',
  'QUERY_ENGINES': 'Query Engines',
  'TIME_SERIES': 'Time Series Databases',
  'OTHER': 'Other Databases',
  'OPEN_SOURCE': 'Open Source',
  'HOSTED_OPEN_SOURCE': 'Hosted Open Source',
  'PROPRIETARY': 'Proprietary',
};

// Category colors for visual distinction
const CATEGORY_COLORS: Record<string, string> = {
  'Cloud - AWS': 'orange',
  'Cloud - Google': 'blue',
  'Cloud - Azure': 'cyan',
  'Cloud Data Warehouses': 'purple',
  'Apache Projects': 'red',
  'Traditional RDBMS': 'green',
  'Analytical Databases': 'magenta',
  'Search & NoSQL': 'gold',
  'Query Engines': 'lime',
  'Time Series Databases': 'volcano',
  'Other Databases': 'default',
  // Licensing categories
  'Open Source': 'geekblue',
  'Hosted Open Source': 'cyan',
  'Proprietary': 'default',
};

// Convert category constant to display name
function getCategoryDisplayName(cat: string): string {
  return CATEGORY_DISPLAY_NAMES[cat] || cat;
}

// Get categories for a database - uses categories from metadata when available
// Falls back to name-based inference for compatible databases without categories
function getCategories(
  name: string,
  documentationCategories?: string[]
): string[] {
  // Prefer categories from documentation metadata (computed by Python)
  if (documentationCategories && documentationCategories.length > 0) {
    return documentationCategories.map(getCategoryDisplayName);
  }

  // Fallback: infer from name (for compatible databases without categories)
  const nameLower = name.toLowerCase();

  if (nameLower.includes('aws') || nameLower.includes('amazon'))
    return ['Cloud - AWS'];
  if (nameLower.includes('google') || nameLower.includes('bigquery'))
    return ['Cloud - Google'];
  if (nameLower.includes('azure') || nameLower.includes('microsoft'))
    return ['Cloud - Azure'];
  if (nameLower.includes('snowflake') || nameLower.includes('databricks'))
    return ['Cloud Data Warehouses'];
  if (
    nameLower.includes('apache') ||
    nameLower.includes('druid') ||
    nameLower.includes('hive') ||
    nameLower.includes('spark')
  )
    return ['Apache Projects'];
  if (
    nameLower.includes('postgres') ||
    nameLower.includes('mysql') ||
    nameLower.includes('sqlite') ||
    nameLower.includes('mariadb')
  )
    return ['Traditional RDBMS'];
  if (
    nameLower.includes('clickhouse') ||
    nameLower.includes('vertica') ||
    nameLower.includes('starrocks')
  )
    return ['Analytical Databases'];
  if (
    nameLower.includes('elastic') ||
    nameLower.includes('solr') ||
    nameLower.includes('couchbase')
  )
    return ['Search & NoSQL'];
  if (nameLower.includes('trino') || nameLower.includes('presto'))
    return ['Query Engines'];

  return ['Other Databases'];
}

// Count supported time grains
function countTimeGrains(db: DatabaseInfo): number {
  if (!db.time_grains) return 0;
  return Object.values(db.time_grains).filter(Boolean).length;
}

// Format time grain name for display (e.g., FIVE_MINUTES -> "5 min")
function formatTimeGrain(grain: string): string {
  const mapping: Record<string, string> = {
    SECOND: 'Second',
    FIVE_SECONDS: '5 sec',
    THIRTY_SECONDS: '30 sec',
    MINUTE: 'Minute',
    FIVE_MINUTES: '5 min',
    TEN_MINUTES: '10 min',
    FIFTEEN_MINUTES: '15 min',
    THIRTY_MINUTES: '30 min',
    HALF_HOUR: '30 min',
    HOUR: 'Hour',
    SIX_HOURS: '6 hours',
    DAY: 'Day',
    WEEK: 'Week',
    WEEK_STARTING_SUNDAY: 'Week (Sun)',
    WEEK_STARTING_MONDAY: 'Week (Mon)',
    WEEK_ENDING_SATURDAY: 'Week (→Sat)',
    WEEK_ENDING_SUNDAY: 'Week (→Sun)',
    MONTH: 'Month',
    QUARTER: 'Quarter',
    QUARTER_YEAR: 'Quarter',
    YEAR: 'Year',
  };
  return mapping[grain] || grain;
}

// Get list of supported time grains for tooltip
function getSupportedTimeGrains(timeGrains?: TimeGrains): string[] {
  if (!timeGrains) return [];
  return Object.entries(timeGrains)
    .filter(([, supported]) => supported)
    .map(([grain]) => formatTimeGrain(grain));
}

const DatabaseIndex: React.FC<DatabaseIndexProps> = ({ data }) => {
  const [searchText, setSearchText] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  const { statistics, databases } = data;

  // Convert databases object to array, including compatible databases
  const databaseList = useMemo(() => {
    const entries: TableEntry[] = [];

    Object.entries(databases).forEach(([name, db]) => {
      // Add the main database
      // Use categories from documentation metadata (computed by Python) when available
      entries.push({
        ...db,
        name,
        categories: getCategories(name, db.documentation?.categories),
        timeGrainCount: countTimeGrains(db),
        hasDrivers: (db.documentation?.drivers?.length ?? 0) > 0,
        hasAuthMethods: (db.documentation?.authentication_methods?.length ?? 0) > 0,
        hasConnectionString: Boolean(
          db.documentation?.connection_string ||
            (db.documentation?.drivers?.length ?? 0) > 0
        ),
        hasCustomErrors: (db.documentation?.custom_errors?.length ?? 0) > 0,
        customErrorCount: db.documentation?.custom_errors?.length ?? 0,
        isCompatible: false,
      });

      // Add compatible databases from this database's documentation
      const compatibleDbs = db.documentation?.compatible_databases ?? [];
      compatibleDbs.forEach((compat) => {
        // Check if this compatible DB already exists as a main entry
        const existsAsMain = Object.keys(databases).some(
          (dbName) => dbName.toLowerCase() === compat.name.toLowerCase()
        );

        if (!existsAsMain) {
          // Compatible databases: use their categories if defined, or infer from name
          entries.push({
            name: compat.name,
            categories: getCategories(compat.name, compat.categories),
            // Compatible DBs inherit scores from parent
            score: db.score,
            max_score: db.max_score,
            timeGrainCount: countTimeGrains(db),
            hasDrivers: false,
            hasAuthMethods: false,
            hasConnectionString: Boolean(compat.connection_string),
            hasCustomErrors: false,
            customErrorCount: 0,
            joins: db.joins,
            subqueries: db.subqueries,
            supports_dynamic_schema: db.supports_dynamic_schema,
            supports_catalog: db.supports_catalog,
            ssh_tunneling: db.ssh_tunneling,
            documentation: {
              description: compat.description,
              connection_string: compat.connection_string,
              pypi_packages: compat.pypi_packages,
            },
            isCompatible: true,
            compatibleWith: name,
            compatibleDescription: `Uses ${name} driver`,
          });
        }
      });
    });

    return entries;
  }, [databases]);

  // Filter and sort databases
  const filteredDatabases = useMemo(() => {
    return databaseList
      .filter((db) => {
        const matchesSearch =
          !searchText ||
          db.name.toLowerCase().includes(searchText.toLowerCase()) ||
          db.documentation?.description
            ?.toLowerCase()
            .includes(searchText.toLowerCase());
        const matchesCategory = !categoryFilter || db.categories.includes(categoryFilter);
        return matchesSearch && matchesCategory;
      })
      .sort((a, b) => b.score - a.score);
  }, [databaseList, searchText, categoryFilter]);

  // Get unique categories and counts for filter
  const { categories, categoryCounts } = useMemo(() => {
    const counts: Record<string, number> = {};
    databaseList.forEach((db) => {
      // Count each category the database belongs to
      db.categories.forEach((cat) => {
        counts[cat] = (counts[cat] || 0) + 1;
      });
    });
    return {
      categories: Object.keys(counts).sort(),
      categoryCounts: counts,
    };
  }, [databaseList]);

  // Table columns
  const columns = [
    {
      title: 'Database',
      dataIndex: 'name',
      key: 'name',
      sorter: (a: TableEntry, b: TableEntry) => a.name.localeCompare(b.name),
      render: (name: string, record: TableEntry) => {
        // Convert name to URL slug
        const toSlug = (n: string) => n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

        // Link to parent for compatible DBs, otherwise to own page
        const linkTarget = record.isCompatible && record.compatibleWith
          ? `/docs/databases/supported/${toSlug(record.compatibleWith)}`
          : `/docs/databases/supported/${toSlug(name)}`;

        return (
          <div>
            <a href={linkTarget}>
              <strong>{name}</strong>
            </a>
            {record.isCompatible && record.compatibleWith && (
              <Tag
                icon={<LinkOutlined />}
                color="geekblue"
                style={{ marginLeft: 8, fontSize: '11px' }}
              >
                {record.compatibleWith} compatible
              </Tag>
            )}
            <div style={{ fontSize: '12px', color: '#666' }}>
              {record.documentation?.description?.slice(0, 80)}
              {(record.documentation?.description?.length ?? 0) > 80 ? '...' : ''}
            </div>
          </div>
        );
      },
    },
    {
      title: 'Categories',
      dataIndex: 'categories',
      key: 'categories',
      width: 220,
      filters: categories.map((cat) => ({ text: cat, value: cat })),
      onFilter: (value: React.Key | boolean, record: TableEntry) =>
        record.categories.includes(value as string),
      render: (cats: string[]) => (
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {cats.map((cat) => (
            <Tag key={cat} color={CATEGORY_COLORS[cat] || 'default'}>{cat}</Tag>
          ))}
        </div>
      ),
    },
    {
      title: 'Score',
      dataIndex: 'score',
      key: 'score',
      width: 80,
      sorter: (a: TableEntry, b: TableEntry) => a.score - b.score,
      defaultSortOrder: 'descend' as const,
      render: (score: number, record: TableEntry) => (
        <span
          style={{
            color: score > 150 ? '#52c41a' : score > 100 ? '#1890ff' : '#666',
            fontWeight: score > 150 ? 'bold' : 'normal',
          }}
        >
          {score}/{record.max_score}
        </span>
      ),
    },
    {
      title: 'Time Grains',
      dataIndex: 'timeGrainCount',
      key: 'timeGrainCount',
      width: 100,
      sorter: (a: TableEntry, b: TableEntry) => a.timeGrainCount - b.timeGrainCount,
      render: (count: number, record: TableEntry) => {
        if (count === 0) return <span>-</span>;
        const grains = getSupportedTimeGrains(record.time_grains);
        return (
          <Tooltip
            title={
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: 280 }}>
                {grains.map((grain) => (
                  <Tag key={grain} style={{ margin: 0 }}>{grain}</Tag>
                ))}
              </div>
            }
            placement="top"
          >
            <span style={{ cursor: 'help', borderBottom: '1px dotted #999' }}>
              {count} grains
            </span>
          </Tooltip>
        );
      },
    },
    {
      title: 'Features',
      key: 'features',
      width: 280,
      filters: [
        { text: 'JOINs', value: 'joins' },
        { text: 'Subqueries', value: 'subqueries' },
        { text: 'Dynamic Schema', value: 'dynamic_schema' },
        { text: 'Catalog', value: 'catalog' },
        { text: 'SSH Tunneling', value: 'ssh' },
        { text: 'File Upload', value: 'file_upload' },
        { text: 'Query Cancel', value: 'query_cancel' },
        { text: 'Cost Estimation', value: 'cost_estimation' },
        { text: 'User Impersonation', value: 'impersonation' },
        { text: 'SQL Validation', value: 'sql_validation' },
      ],
      onFilter: (value: React.Key | boolean, record: TableEntry) => {
        switch (value) {
          case 'joins':
            return Boolean(record.joins);
          case 'subqueries':
            return Boolean(record.subqueries);
          case 'dynamic_schema':
            return Boolean(record.supports_dynamic_schema);
          case 'catalog':
            return Boolean(record.supports_catalog);
          case 'ssh':
            return Boolean(record.ssh_tunneling);
          case 'file_upload':
            return Boolean(record.supports_file_upload);
          case 'query_cancel':
            return Boolean(record.query_cancelation);
          case 'cost_estimation':
            return Boolean(record.query_cost_estimation);
          case 'impersonation':
            return Boolean(record.user_impersonation);
          case 'sql_validation':
            return Boolean(record.sql_validation);
          default:
            return true;
        }
      },
      render: (_: unknown, record: TableEntry) => (
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {record.joins && <Tag color="green">JOINs</Tag>}
          {record.subqueries && <Tag color="green">Subqueries</Tag>}
          {record.supports_dynamic_schema && <Tag color="blue">Dynamic Schema</Tag>}
          {record.supports_catalog && <Tag color="purple">Catalog</Tag>}
          {record.ssh_tunneling && <Tag color="cyan">SSH</Tag>}
          {record.supports_file_upload && <Tag color="orange">File Upload</Tag>}
          {record.query_cancelation && <Tag color="volcano">Query Cancel</Tag>}
          {record.query_cost_estimation && <Tag color="gold">Cost Est.</Tag>}
          {record.user_impersonation && <Tag color="magenta">Impersonation</Tag>}
          {record.sql_validation && <Tag color="lime">SQL Validation</Tag>}
        </div>
      ),
    },
    {
      title: 'Documentation',
      key: 'docs',
      width: 180,
      render: (_: unknown, record: TableEntry) => (
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {record.hasConnectionString && (
            <Tag icon={<ApiOutlined />} color="default">
              Connection
            </Tag>
          )}
          {record.hasDrivers && (
            <Tag icon={<DatabaseOutlined />} color="default">
              Drivers
            </Tag>
          )}
          {record.hasAuthMethods && (
            <Tag icon={<KeyOutlined />} color="default">
              Auth
            </Tag>
          )}
          {record.hasCustomErrors && (
            <Tooltip title={`${record.customErrorCount} troubleshooting tips`}>
              <Tag icon={<BugOutlined />} color="volcano">
                Errors
              </Tag>
            </Tooltip>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="database-index">
      {/* Statistics Cards */}
      {/* Statistics Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="Total Databases"
              value={statistics.totalDatabases}
              prefix={<DatabaseOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="With Documentation"
              value={statistics.withDocumentation}
              prefix={<CheckCircleOutlined />}
              suffix={`/ ${statistics.totalDatabases}`}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="Multiple Drivers"
              value={statistics.withDrivers}
              prefix={<ApiOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="Auth Methods"
              value={statistics.withAuthMethods}
              prefix={<KeyOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* Filters */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12}>
          <Input
            placeholder="Search databases..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
          />
        </Col>
        <Col xs={24} sm={12}>
          <Select
            placeholder="Filter by category"
            style={{ width: '100%' }}
            value={categoryFilter}
            onChange={setCategoryFilter}
            allowClear
            options={categories.map((cat) => ({
              label: (
                <span>
                  <Tag
                    color={CATEGORY_COLORS[cat] || 'default'}
                    style={{ marginRight: 8 }}
                  >
                    {categoryCounts[cat] || 0}
                  </Tag>
                  {cat}
                </span>
              ),
              value: cat,
            }))}
          />
        </Col>
      </Row>

      {/* Database Table */}
      <Table
        dataSource={filteredDatabases}
        columns={columns}
        rowKey={(record) => record.isCompatible ? `${record.compatibleWith}-${record.name}` : record.name}
        pagination={{
          defaultPageSize: 20,
          showSizeChanger: true,
          showTotal: (total) => `${total} databases`,
        }}
        size="middle"
      />
    </div>
  );
};

export default DatabaseIndex;

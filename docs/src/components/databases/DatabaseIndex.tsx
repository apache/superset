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
import { Card, Row, Col, Statistic, Table, Tag, Input, Select } from 'antd';
import {
  DatabaseOutlined,
  CheckCircleOutlined,
  ApiOutlined,
  KeyOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import type { DatabaseData, DatabaseInfo, SortField } from './types';

interface DatabaseIndexProps {
  data: DatabaseData;
}

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
  'Other Databases': 'default',
};

// Get category for a database
function getCategory(name: string): string {
  const nameLower = name.toLowerCase();

  if (nameLower.includes('aws') || nameLower.includes('amazon'))
    return 'Cloud - AWS';
  if (nameLower.includes('google') || nameLower.includes('bigquery'))
    return 'Cloud - Google';
  if (nameLower.includes('azure') || nameLower.includes('microsoft'))
    return 'Cloud - Azure';
  if (nameLower.includes('snowflake') || nameLower.includes('databricks'))
    return 'Cloud Data Warehouses';
  if (
    nameLower.includes('apache') ||
    nameLower.includes('druid') ||
    nameLower.includes('hive') ||
    nameLower.includes('spark')
  )
    return 'Apache Projects';
  if (
    nameLower.includes('postgres') ||
    nameLower.includes('mysql') ||
    nameLower.includes('sqlite') ||
    nameLower.includes('mariadb')
  )
    return 'Traditional RDBMS';
  if (
    nameLower.includes('clickhouse') ||
    nameLower.includes('vertica') ||
    nameLower.includes('starrocks')
  )
    return 'Analytical Databases';
  if (
    nameLower.includes('elastic') ||
    nameLower.includes('solr') ||
    nameLower.includes('couchbase')
  )
    return 'Search & NoSQL';
  if (nameLower.includes('trino') || nameLower.includes('presto'))
    return 'Query Engines';

  return 'Other Databases';
}

// Count supported time grains
function countTimeGrains(db: DatabaseInfo): number {
  if (!db.time_grains) return 0;
  return Object.values(db.time_grains).filter(Boolean).length;
}

const DatabaseIndex: React.FC<DatabaseIndexProps> = ({ data }) => {
  const [searchText, setSearchText] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  const { statistics, databases } = data;

  // Convert databases object to array and add category
  const databaseList = useMemo(() => {
    return Object.entries(databases).map(([name, db]) => ({
      ...db,
      name,
      category: getCategory(name),
      timeGrainCount: countTimeGrains(db),
      hasDrivers: (db.documentation?.drivers?.length ?? 0) > 0,
      hasAuthMethods: (db.documentation?.authentication_methods?.length ?? 0) > 0,
      hasConnectionString: Boolean(
        db.documentation?.connection_string ||
          (db.documentation?.drivers?.length ?? 0) > 0
      ),
    }));
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
        const matchesCategory = !categoryFilter || db.category === categoryFilter;
        return matchesSearch && matchesCategory;
      })
      .sort((a, b) => b.score - a.score);
  }, [databaseList, searchText, categoryFilter]);

  // Get unique categories for filter
  const categories = useMemo(() => {
    const cats = new Set(databaseList.map((db) => db.category));
    return Array.from(cats).sort();
  }, [databaseList]);

  // Table columns
  const columns = [
    {
      title: 'Database',
      dataIndex: 'name',
      key: 'name',
      sorter: (a: typeof filteredDatabases[0], b: typeof filteredDatabases[0]) =>
        a.name.localeCompare(b.name),
      render: (name: string, record: typeof filteredDatabases[0]) => (
        <div>
          <a href={`#${name.toLowerCase().replace(/\s+/g, '-')}`}>
            <strong>{name}</strong>
          </a>
          <div style={{ fontSize: '12px', color: '#666' }}>
            {record.documentation?.description?.slice(0, 80)}
            {(record.documentation?.description?.length ?? 0) > 80 ? '...' : ''}
          </div>
        </div>
      ),
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      width: 160,
      filters: categories.map((cat) => ({ text: cat, value: cat })),
      onFilter: (value: React.Key | boolean, record: typeof filteredDatabases[0]) =>
        record.category === value,
      render: (category: string) => (
        <Tag color={CATEGORY_COLORS[category] || 'default'}>{category}</Tag>
      ),
    },
    {
      title: 'Score',
      dataIndex: 'score',
      key: 'score',
      width: 80,
      sorter: (a: typeof filteredDatabases[0], b: typeof filteredDatabases[0]) =>
        a.score - b.score,
      defaultSortOrder: 'descend' as const,
      render: (score: number, record: typeof filteredDatabases[0]) => (
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
      sorter: (a: typeof filteredDatabases[0], b: typeof filteredDatabases[0]) =>
        a.timeGrainCount - b.timeGrainCount,
      render: (count: number) => (
        <span>{count > 0 ? `${count} grains` : '-'}</span>
      ),
    },
    {
      title: 'Features',
      key: 'features',
      width: 200,
      render: (_: unknown, record: typeof filteredDatabases[0]) => (
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {record.joins && <Tag color="green">JOINs</Tag>}
          {record.subqueries && <Tag color="green">Subqueries</Tag>}
          {record.supports_dynamic_schema && <Tag color="blue">Dynamic Schema</Tag>}
          {record.supports_catalog && <Tag color="purple">Catalog</Tag>}
          {record.ssh_tunneling && <Tag color="cyan">SSH</Tag>}
        </div>
      ),
    },
    {
      title: 'Documentation',
      key: 'docs',
      width: 150,
      render: (_: unknown, record: typeof filteredDatabases[0]) => (
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
        </div>
      ),
    },
  ];

  return (
    <div className="database-index">
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
                    {statistics.byCategory[cat]?.length || 0}
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
        rowKey="name"
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
          showTotal: (total) => `${total} databases`,
        }}
        size="middle"
      />
    </div>
  );
};

export default DatabaseIndex;

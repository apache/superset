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
  AppstoreOutlined,
  ApiOutlined,
  PictureOutlined,
  PlayCircleOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import type { ComponentData, ComponentEntry } from './types';

interface ComponentIndexProps {
  data: ComponentData;
}

const CATEGORY_COLORS: Record<string, string> = {
  ui: 'blue',
  'design-system': 'green',
  extension: 'purple',
};

const CATEGORY_LABELS: Record<string, string> = {
  ui: 'Core',
  'design-system': 'Layout',
  extension: 'Extension',
};

const ComponentIndex: React.FC<ComponentIndexProps> = ({ data }) => {
  const [searchText, setSearchText] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  const { statistics, components } = data;

  const filteredComponents = useMemo(() => {
    return components
      .filter((comp) => {
        const matchesSearch =
          !searchText ||
          comp.name.toLowerCase().includes(searchText.toLowerCase()) ||
          comp.description.toLowerCase().includes(searchText.toLowerCase()) ||
          comp.package.toLowerCase().includes(searchText.toLowerCase());
        const matchesCategory =
          !categoryFilter || comp.category === categoryFilter;
        return matchesSearch && matchesCategory;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [components, searchText, categoryFilter]);

  const { categories, categoryCounts } = useMemo(() => {
    const counts: Record<string, number> = {};
    components.forEach((comp) => {
      counts[comp.category] = (counts[comp.category] || 0) + 1;
    });
    return {
      categories: Object.keys(counts).sort(),
      categoryCounts: counts,
    };
  }, [components]);

  const columns = [
    {
      title: 'Component',
      dataIndex: 'name',
      key: 'name',
      sorter: (a: ComponentEntry, b: ComponentEntry) =>
        a.name.localeCompare(b.name),
      defaultSortOrder: 'ascend' as const,
      render: (name: string, record: ComponentEntry) => (
        <div>
          <a href={`/${record.docPath}`}>
            <strong>{name}</strong>
          </a>
          {record.description && (
            <div style={{ fontSize: '12px', color: '#666' }}>
              {record.description.slice(0, 100)}
              {record.description.length > 100 ? '...' : ''}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      width: 120,
      filters: categories.map((cat) => ({
        text: CATEGORY_LABELS[cat] || cat,
        value: cat,
      })),
      onFilter: (value: React.Key | boolean, record: ComponentEntry) =>
        record.category === value,
      render: (cat: string) => (
        <Tag color={CATEGORY_COLORS[cat] || 'default'}>
          {CATEGORY_LABELS[cat] || cat}
        </Tag>
      ),
    },
    {
      title: 'Package',
      dataIndex: 'package',
      key: 'package',
      width: 220,
      render: (pkg: string) => (
        <code style={{ fontSize: '12px' }}>{pkg}</code>
      ),
    },
    {
      title: 'Tags',
      key: 'tags',
      width: 280,
      filters: [
        { text: 'Extension Compatible', value: 'extension' },
        { text: 'Gallery', value: 'gallery' },
        { text: 'Live Demo', value: 'demo' },
      ],
      onFilter: (value: React.Key | boolean, record: ComponentEntry) => {
        switch (value) {
          case 'extension':
            return record.extensionCompatible;
          case 'gallery':
            return record.hasGallery;
          case 'demo':
            return record.hasLiveExample;
          default:
            return true;
        }
      },
      render: (_: unknown, record: ComponentEntry) => (
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {record.extensionCompatible && (
            <Tag color="purple">Extension Compatible</Tag>
          )}
          {record.hasGallery && <Tag color="cyan">Gallery</Tag>}
          {record.hasLiveExample && <Tag color="green">Demo</Tag>}
        </div>
      ),
    },
    {
      title: 'Props',
      dataIndex: 'propsCount',
      key: 'propsCount',
      width: 80,
      sorter: (a: ComponentEntry, b: ComponentEntry) =>
        a.propsCount - b.propsCount,
      render: (count: number) => (
        <span style={{ color: count > 0 ? '#1890ff' : '#999' }}>{count}</span>
      ),
    },
  ];

  return (
    <div className="component-index">
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="Total Components"
              value={statistics.totalComponents}
              prefix={<AppstoreOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="Extension Compatible"
              value={statistics.extensionCompatible}
              prefix={<ApiOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="With Gallery"
              value={statistics.withGallery}
              prefix={<PictureOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="With Live Demo"
              value={statistics.withLiveExample}
              prefix={<PlayCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12}>
          <Input
            placeholder="Search components..."
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
                  {CATEGORY_LABELS[cat] || cat}
                </span>
              ),
              value: cat,
            }))}
          />
        </Col>
      </Row>

      <Table
        dataSource={filteredComponents}
        columns={columns}
        rowKey="name"
        pagination={{
          defaultPageSize: 20,
          showSizeChanger: true,
          showTotal: (total) => `${total} components`,
        }}
        size="middle"
      />
    </div>
  );
};

export default ComponentIndex;

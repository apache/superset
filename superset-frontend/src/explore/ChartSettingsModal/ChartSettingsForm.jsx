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
import React, { useState, useEffect, useRef } from 'react';
import { Modal, Form, Input, Row, Col, InputNumber, Select, Button, Skeleton } from 'antd';
import { t } from '@superset-ui/translation';
import { usePossibleOwners } from './possibleOwnersHooks';

//Work around for antd components that add themselves to the body.
const tempContainer = () => document.getElementById('antdPortal');

const ChartSettingsForm = ({ chart = {}, error = {}, form, onFinish }) => {
  const [{ data: owners = [], isLoading }] = usePossibleOwners();

  if (error.type === 'INVALID_PROPS') {
    form.setFields(
      Object
        .entries(error?.extra || {})
        .map(([key, value]) => ({ name: key, errors: value }))
    );
  }

  return (
    <Form
      form={form}
      name="basic"
      layout="vertical"
      initialValues={{ ...chart }}
      onFinish={onFinish}
    >
      <Row gutter={[16, 16]}>
        <Col md={24}>
          <h4>{t('Basic Information')}</h4>
          <Form.Item
            label={t('Name')}
            name="name"
            rules={[
              {
                required: true,
                message: 'Chart must have a name',
              },
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label={t('Description')}
            name="description"
            extra={t(
              'The description can be displayed as widget headers in the dashboard view. Supports markdown.',
            )}
          >
            <Input.TextArea />
          </Form.Item>
        </Col>
        <Col md={24}>
          <h4>{t('Configuration')}</h4>
          <Form.Item
            label={t('Cache Timeout')}
            name="cacheTimeout"
            extra={t(
              'Duration (in seconds) of the caching timeout for this chart. Note this defaults to the datasource/table timeout if undefined.',
            )}
          >
            <InputNumber min={0} max={9999} />
          </Form.Item>
        </Col>
        <Col md={24}>
          <h4>{t('Access')}</h4>
          <Form.Item
            label={t('Owners')}
            name="owners"
            rules={[
              {
                required: true,
                message: 'Chart must have an owner',
              },
            ]}
            extra={t(
              'A list of users who can alter the chart. Searchable by name or username.',
            )}
          >
            <Select
              mode="multiple"
              placeholder="Please select an owner."
              style={{ width: '100%' }}
              getPopupContainer={tempContainer}
            >
              {owners.map(owner => (
                <Select.Option key={owner.value} value={owner.value}>
                  {owner.text}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Col>
      </Row>
    </Form>
  );
};
export default ChartSettingsForm;
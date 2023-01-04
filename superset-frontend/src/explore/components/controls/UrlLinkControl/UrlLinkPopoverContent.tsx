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
import { styled, t } from '@superset-ui/core';
import { Form, FormItem } from 'src/components/Form';
import { Col, Row } from 'src/components';
import { TextArea, Input } from 'src/components/Input';
import Button from 'src/components/Button';
import { UrlLinkConfig } from './types';

const FullWidthInput = styled(Input)`
  width: 100%;
`;

const FullWidthTextarea = styled(TextArea)`
  width: 100%;
`;

const JustifyEnd = styled.div`
  display: flex;
  justify-content: flex-end;
`;

const rulesRequired = [{ required: true, message: t('Required') }];

const schemaPlaceholder = `
You can use column name as a variable to splice url. 
such as: https://superset.apache.org/docs/miscellaneous/issue-codes#issue-$\{issueId}`;

export const UrlLinkPopoverContent = ({
  config,
  onChange,
  columns = [],
}: {
  config?: UrlLinkConfig;
  onChange: (config: UrlLinkConfig) => void;
  columns: string[];
}) => (
  <Form
    onFinish={onChange}
    initialValues={config}
    requiredMark="optional"
    layout="vertical"
  >
    <Row gutter={24}>
      <Col span={12}>
        <FormItem
          name="columnName"
          label={t('link column name')}
          rules={rulesRequired}
        >
          <FullWidthInput />
        </FormItem>
      </Col>
      <Col span={12}>
        <FormItem name="linkText" label={t('link text')} rules={rulesRequired}>
          <FullWidthInput />
        </FormItem>
      </Col>
    </Row>
    <Row gutter={24}>
      <Col span={24}>
        <FormItem
          name="linkSchema"
          label={t('link schema')}
          rules={rulesRequired}
        >
          <FullWidthTextarea rows={4} placeholder={schemaPlaceholder} />
        </FormItem>
      </Col>
    </Row>
    <FormItem>
      <JustifyEnd>
        <Button htmlType="submit" buttonStyle="primary">
          {t('Apply')}
        </Button>
      </JustifyEnd>
    </FormItem>
  </Form>
);

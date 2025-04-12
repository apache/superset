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
import { Meta, StoryFn } from '@storybook/react';
import { Layout, Row, Col, Card } from 'antd-v5';
import ErrorAlert from './ErrorAlert';

const { Content } = Layout;

const longDescription = `This is a detailed description to test long content display.
Line breaks are included here to demonstrate pre-wrap styling.
This is useful for verbose error messages.`;

const sqlErrorDescription = `SQL Error: Syntax error near unexpected token.
Please check your query and ensure it follows the correct syntax.`;

const detailsExample = `Additional details about the issue are provided here.
This content is shown when the user clicks "Show more".`;

const ErrorCard: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Card>{children}</Card>
);

export default {
  title: 'Components/ErrorAlert',
  component: ErrorAlert,
} as Meta;

export const Gallery: StoryFn = () => (
  <Layout>
    <Content style={{ padding: '24px' }}>
      <h2>Non-Compact Errors</h2>
      <Row gutter={[16, 16]}>
        <Col xs={48} sm={24} md={16} lg={16} xl={12}>
          <ErrorCard>
            <ErrorAlert message="Only message props was passed here" />
          </ErrorCard>
        </Col>
        <Col xs={48} sm={24} md={16} lg={16} xl={12}>
          <ErrorCard>
            <ErrorAlert
              errorType="Database Connection Error"
              type="warning"
              message="Failed to connect to database"
              descriptionDetails={detailsExample}
              descriptionDetailsCollapsed
            />
          </ErrorCard>
        </Col>
        <Col xs={48} sm={24} md={16} lg={16} xl={12}>
          <ErrorCard>
            <ErrorAlert
              errorType="Error"
              message="SQL Syntax Error - No defaults set here"
              description={sqlErrorDescription}
              descriptionDetails={detailsExample}
              descriptionDetailsCollapsed
              descriptionPre
            />
          </ErrorCard>
        </Col>
        <Col xs={48} sm={24} md={16} lg={16} xl={12}>
          <ErrorCard>
            <ErrorAlert
              errorType="Error"
              message="See the details below"
              type="error"
              description={longDescription}
              descriptionDetails={detailsExample}
              descriptionDetailsCollapsed={false}
            />
          </ErrorCard>
        </Col>
        <Col xs={48} sm={24} md={16} lg={16} xl={12}>
          <ErrorCard>
            <ErrorAlert
              errorType="Informational Warning"
              message="This is a non-pre-wrap styled description"
              type="info"
              description={longDescription}
              descriptionDetails={detailsExample}
              descriptionDetailsCollapsed={false}
              descriptionPre={false}
            />
          </ErrorCard>
        </Col>
        <Col xs={24} sm={12} md={8} lg={8} xl={6}>
          <ErrorCard>
            <ErrorAlert
              errorType="Error"
              message="Something went wrong"
              type="error"
            />
          </ErrorCard>
        </Col>
        <Col xs={24} sm={12} md={8} lg={8} xl={6}>
          <ErrorCard>
            <ErrorAlert
              errorType="Warning"
              message="Be cautious"
              type="warning"
            />
          </ErrorCard>
        </Col>
      </Row>
      <h2>Compact Errors (with Modal)</h2>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={8} lg={8} xl={6}>
          <ErrorCard>
            <ErrorAlert
              errorType="Error"
              message="Compact mode example"
              type="error"
              compact
              descriptionDetailsCollapsed
              description={sqlErrorDescription}
              descriptionDetails={detailsExample}
            />
          </ErrorCard>
        </Col>
        <Col xs={24} sm={12} md={8} lg={8} xl={6}>
          <ErrorCard>
            <ErrorAlert
              errorType="Warning"
              message="Compact mode example"
              type="warning"
              compact
              descriptionDetails={detailsExample}
              descriptionDetailsCollapsed
            />
          </ErrorCard>
        </Col>
      </Row>
    </Content>
  </Layout>
);

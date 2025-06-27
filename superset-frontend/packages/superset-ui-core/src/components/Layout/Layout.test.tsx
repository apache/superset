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
import { useState } from 'react';
import { render, screen, fireEvent } from '@superset-ui/core/spec';
import { Layout } from '.';
import { Button } from '../Button';

describe('Layout Component', () => {
  it('renders Layout with Header, Content, and Footer', () => {
    render(
      <Layout hasSider={false}>
        <Layout.Header>Header</Layout.Header>
        <Layout.Content>Content Area</Layout.Content>
        <Layout.Footer>Ant Design Layout Footer</Layout.Footer>
      </Layout>,
    );

    expect(screen.getByText('Header')).toBeInTheDocument();
    expect(screen.getByText('Content Area')).toBeInTheDocument();
    expect(screen.getByText('Ant Design Layout Footer')).toBeInTheDocument();
  });

  it('renders Layout with Sider when hasSider is true', () => {
    render(
      <Layout hasSider>
        <Layout.Sider>Sider Content</Layout.Sider>
      </Layout>,
    );

    expect(screen.getByText('Sider Content')).toBeInTheDocument();
  });

  it('hides Header when headerVisible is false', () => {
    render(
      <Layout>
        {false && <Layout.Header>Header</Layout.Header>}
        <Layout.Content>Content Area</Layout.Content>
        <Layout.Footer>Ant Design Layout Footer</Layout.Footer>
      </Layout>,
    );

    expect(screen.queryByText('Header')).not.toBeInTheDocument();
  });

  it('hides Footer when footerVisible is false', () => {
    render(
      <Layout>
        <Layout.Header>Header</Layout.Header>
        <Layout.Content>Content Area</Layout.Content>
        {false && <Layout.Footer>Ant Design Layout Footer</Layout.Footer>}
      </Layout>,
    );

    expect(
      screen.queryByText('Ant Design Layout Footer'),
    ).not.toBeInTheDocument();
  });
  it('collapses Sider when clicked', () => {
    const TestLayout = () => {
      const [collapsed, setCollapsed] = useState(false);

      return (
        <Layout hasSider>
          <Layout.Sider
            collapsible
            collapsed={collapsed}
            collapsedWidth={80}
            width={200}
          >
            <Button onClick={() => setCollapsed(!collapsed)}>Toggle</Button>
            Sider Content
          </Layout.Sider>
        </Layout>
      );
    };

    render(<TestLayout />);

    const toggleButton = screen.getByRole('button', { name: 'Toggle' });

    expect(screen.getByText('Sider Content').parentElement).toHaveStyle({
      width: '200px',
    });

    fireEvent.click(toggleButton);

    expect(screen.getByText('Sider Content').parentElement).toHaveStyle({
      width: '80px',
    });
  });
});

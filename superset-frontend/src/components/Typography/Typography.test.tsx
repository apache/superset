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
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import Typography from 'src/components/Typography';

describe('Typography Component', () => {
  test('renders Text component', () => {
    render(<Typography.Text>Text Content</Typography.Text>);
    expect(screen.getByText('Text Content')).toBeInTheDocument();
  });

  test('renders Title component', () => {
    render(<Typography.Title level={2}>Title Content</Typography.Title>);
    expect(screen.getByText('Title Content')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
  });

  test('renders Paragraph component', () => {
    render(<Typography.Paragraph>Paragraph Content</Typography.Paragraph>);
    expect(screen.getByText('Paragraph Content')).toBeInTheDocument();
  });

  test('renders Link component', () => {
    render(
      <Typography.Link href="https://example.com">
        Link Content
      </Typography.Link>,
    );
    const link = screen.getByRole('link', { name: 'Link Content' });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'https://example.com');
  });

  test('renders strong text', () => {
    render(<Typography.Text strong>Strong Text</Typography.Text>);
    expect(screen.getByText('Strong Text')).toHaveStyle('font-weight: 600');
  });

  test('renders underlined text', () => {
    render(<Typography.Text underline>Underlined Text</Typography.Text>);
    expect(screen.getByText('Underlined Text')).toHaveStyle(
      'text-decoration: underline',
    );
  });

  test('renders disabled text', () => {
    render(<Typography.Text disabled>Disabled Text</Typography.Text>);
    expect(screen.getByText('Disabled Text')).toHaveClass(
      'ant-typography-disabled',
    );
  });
});

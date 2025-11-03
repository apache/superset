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
import { render, screen } from '@superset-ui/core/spec';
import '@testing-library/jest-dom';
import { Skeleton } from '.';

describe('Skeleton Component', () => {
  it('renders skeleton', () => {
    render(<Skeleton loading paragraph={{ rows: 3 }} active />);

    expect(screen.getByRole('list')).toHaveClass('ant-skeleton-paragraph');
  });

  it('renders skeleton with correct number of paragraph rows', () => {
    render(<Skeleton loading paragraph={{ rows: 3 }} active />);

    const paragraph = screen.getByRole('list');
    expect(paragraph.children.length).toBe(3);
  });

  it('does not render skeleton when loading is false', () => {
    render(
      <Skeleton loading={false} active>
        <p>Loaded Content</p>
      </Skeleton>,
    );

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByText('Loaded Content')).toBeInTheDocument();
  });
});

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
import { render, screen } from 'spec/helpers/testing-library';
import { Icons } from '@superset-ui/core/components';
import { ModalTitleWithIcon } from '.';

describe('ModalTitleWithIcon', () => {
  it('renders the title without icon if none is passed and isEditMode is undefined', () => {
    render(<ModalTitleWithIcon title="My Title" />);
    expect(screen.getByText('My Title')).toBeInTheDocument();

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('renders Edit icon if isEditMode is true', () => {
    render(<ModalTitleWithIcon title="Edit Mode" isEditMode />);
    expect(screen.getByText('Edit Mode')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /edit/i })).toBeInTheDocument();
  });

  it('renders Plus icon if isEditMode is false', () => {
    render(<ModalTitleWithIcon title="Add Mode" isEditMode={false} />);
    expect(screen.getByText('Add Mode')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /plus/i })).toBeInTheDocument();
  });

  it('renders custom icon when passed explicitly', () => {
    render(
      <ModalTitleWithIcon
        title="Custom Icon"
        icon={<Icons.DownOutlined data-test="custom-icon" />}
      />,
    );
    expect(screen.getByText('Custom Icon')).toBeInTheDocument();
    expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
  });

  it('respects the level prop (e.g., renders h3 for level=3)', () => {
    const { container } = render(
      <ModalTitleWithIcon title="Header Level 3" level={3} />,
    );
    expect(container.querySelector('h3')).toHaveTextContent('Header Level 3');
  });
});

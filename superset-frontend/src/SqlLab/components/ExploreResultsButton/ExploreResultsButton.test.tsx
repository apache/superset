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

import ExploreResultsButton, {
  ExploreResultsButtonProps,
} from 'src/SqlLab/components/ExploreResultsButton';
import { OnClickHandler } from 'src/components/Button';

const setup = (
  onClickFn: OnClickHandler,
  props: Partial<ExploreResultsButtonProps> = {},
) =>
  render(<ExploreResultsButton onClick={onClickFn} {...props} />, {
    useRedux: true,
  });

describe('ExploreResultsButton', () => {
  it('renders', async () => {
    const { queryByText } = setup(jest.fn(), {
      database: { allows_subquery: true },
    });

    expect(queryByText('Create Chart')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Chart' })).toBeEnabled();
  });

  it('renders disabled if subquery not allowed', async () => {
    const { queryByText } = setup(jest.fn());

    expect(queryByText('Create Chart')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Chart' })).toBeDisabled();
  });
});

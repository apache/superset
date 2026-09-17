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
import { defaultState } from 'src/explore/store';
import { render, waitFor } from 'spec/helpers/testing-library';
import { useSelector } from 'react-redux';
import { ExplorePageState } from 'src/explore/types';
import StashFormDataContainer from '.';

const FormDataMock = () => {
  const formData = useSelector(
    (state: ExplorePageState) => state.explore.form_data,
  );

  return <div>{Object.keys(formData).join(':')}</div>;
};

test('should stash form data from fieldNames', () => {
  const { rerender, container } = render(
    <StashFormDataContainer
      shouldStash={false}
      fieldNames={['granularity_sqla']}
    >
      <FormDataMock />
    </StashFormDataContainer>,
    {
      useRedux: true,
      initialState: { explore: { form_data: defaultState.form_data } },
    },
  );
  expect(container.querySelector('div')).toHaveTextContent('granularity_sqla');

  rerender(
    <StashFormDataContainer shouldStash fieldNames={['granularity_sqla']}>
      <FormDataMock />
    </StashFormDataContainer>,
  );
  expect(container.querySelector('div')).not.toHaveTextContent(
    'granularity_sqla',
  );
});

test('should restore form data from fieldNames', async () => {
  const { granularity_sqla, ...formData } = defaultState.form_data;
  const { container } = render(
    <StashFormDataContainer
      shouldStash={false}
      fieldNames={['granularity_sqla']}
    >
      <FormDataMock />
    </StashFormDataContainer>,
    {
      useRedux: true,
      initialState: {
        explore: {
          form_data: formData,
          hiddenFormData: {
            granularity_sqla,
          },
        },
      },
    },
  );
  await waitFor(() =>
    expect(container.querySelector('div')).toHaveTextContent(
      'granularity_sqla',
    ),
  );
});

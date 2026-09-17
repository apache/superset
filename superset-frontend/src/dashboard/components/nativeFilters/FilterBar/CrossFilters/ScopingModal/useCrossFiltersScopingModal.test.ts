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

import { ReactElement } from 'react';
import { renderHook } from '@testing-library/react-hooks';
import { createWrapper, render } from 'spec/helpers/testing-library';
import { useCrossFiltersScopingModal } from './useCrossFiltersScopingModal';

test('Renders modal after calling method open', async () => {
  const { result } = renderHook(() => useCrossFiltersScopingModal(), {
    wrapper: createWrapper(),
  });

  const [openModal, Modal] = result.current;
  expect(Modal).toBeNull();

  openModal();

  const { getByText } = render(result.current[1] as ReactElement, {
    useRedux: true,
  });

  expect(getByText('Cross-filtering scoping')).toBeInTheDocument();
});

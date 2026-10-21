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
import { render } from 'spec/helpers/testing-library';

import { BaseModalWrapper } from './SharedStyles';

test('filter config modal is bounded by its containing block', () => {
  const { rerender } = render(
    <BaseModalWrapper expanded={false} open>
      <div>Modal content</div>
    </BaseModalWrapper>,
  );

  const modal = document.querySelector('.ant-modal');
  expect(modal).toBeInTheDocument();
  expect(modal).toHaveStyleRule('width', '880px!important');
  expect(modal).toHaveStyleRule('max-width', 'calc(100% - 32px)');
  expect(modal).not.toHaveStyleRule('min-width', '880px');

  rerender(
    <BaseModalWrapper expanded open>
      <div>Modal content</div>
    </BaseModalWrapper>,
  );
  expect(document.querySelector('.ant-modal')).toHaveStyleRule(
    'width',
    '100%!important',
  );
});

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
/**
 * Button itself now lives in `@apache-superset/core`, and its behaviour is
 * tested there, next to the implementation. What stays here is the one test
 * that cannot move: the gallery is built from `Button.stories`, and
 * Storybook lives in this package. It covers the re-export below as well,
 * which is the other thing this package still owns.
 */
import { render } from '@superset-ui/core/spec';
import {
  ButtonGallery,
  SIZES as buttonSizes,
  STYLES as buttonStyles,
} from './Button.stories';

test('All the storybook gallery variants mount', () => {
  const { getAllByRole } = render(<ButtonGallery />);
  const permutationCount =
    Object.values(buttonStyles.options).filter(o => o).length *
    Object.values(buttonSizes.options).length;

  expect(getAllByRole('button')).toHaveLength(permutationCount);
});

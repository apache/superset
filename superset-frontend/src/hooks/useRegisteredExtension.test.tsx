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

import { act, render, screen } from 'spec/helpers/testing-library';
import { getExtensionsRegistry } from '@superset-ui/core';
import useRegisteredExtension from './useRegisteredExtension';

const Probe = () => {
  const Provider = useRegisteredExtension('root.context.provider');
  return <div>{Provider ? 'registered' : 'absent'}</div>;
};

afterEach(() => {
  getExtensionsRegistry().set('root.context.provider', undefined);
});

test('reports a slot nothing is registered at', () => {
  render(<Probe />);
  expect(screen.getByText('absent')).toBeInTheDocument();
});

test('re-reads after a registration that happens later', () => {
  // The whole point: an extension registers after the application has
  // mounted, so a one-shot read during the first render would report
  // "absent" for the rest of the session and the registration would
  // quietly have no effect.
  render(<Probe />);
  expect(screen.getByText('absent')).toBeInTheDocument();

  act(() => {
    getExtensionsRegistry().set(
      'root.context.provider',
      ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    );
  });

  expect(screen.getByText('registered')).toBeInTheDocument();
});

test('sees a registration that happened before it mounted', () => {
  getExtensionsRegistry().set(
    'root.context.provider',
    ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  );

  render(<Probe />);

  expect(screen.getByText('registered')).toBeInTheDocument();
});

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
import { Tour } from '.';

test('renders the current step when open', () => {
  render(
    <Tour
      open
      steps={[
        { title: 'First step', description: 'First description' },
        { title: 'Second step', description: 'Second description' },
      ]}
    />,
  );
  expect(screen.getByText('First step')).toBeInTheDocument();
  expect(screen.getByText('First description')).toBeInTheDocument();
  expect(screen.queryByText('Second step')).not.toBeInTheDocument();
});

test('renders nothing when closed', () => {
  render(<Tour open={false} steps={[{ title: 'Hidden step' }]} />);
  expect(screen.queryByText('Hidden step')).not.toBeInTheDocument();
});

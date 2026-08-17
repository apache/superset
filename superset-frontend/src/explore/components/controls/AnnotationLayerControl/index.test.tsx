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
import { mapStateToProps } from './index';

type State = Parameters<typeof mapStateToProps>[0];

const buildState = (user: unknown): State =>
  ({
    charts: {},
    explore: {
      controls: {
        viz_type: { value: 'line' },
        color_scheme: { value: 'supersetColors' },
      },
    },
    user,
  }) as unknown as State;

test('grants canReadAnnotation when a role holds can_read on Annotation', () => {
  const state = buildState({
    roles: { Gamma: [['can_read', 'Annotation']] },
  });
  expect(mapStateToProps(state).canReadAnnotation).toBe(true);
});

test('denies canReadAnnotation when no role holds the permission', () => {
  const state = buildState({
    roles: { Gamma: [['can_read', 'Chart']] },
  });
  expect(mapStateToProps(state).canReadAnnotation).toBe(false);
});

test('denies canReadAnnotation when the user has no roles', () => {
  expect(mapStateToProps(buildState({})).canReadAnnotation).toBe(false);
  expect(mapStateToProps(buildState(undefined)).canReadAnnotation).toBe(false);
});

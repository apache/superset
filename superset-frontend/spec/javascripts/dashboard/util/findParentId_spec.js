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
import findParentId from '../../../../src/dashboard/util/findParentId';

describe('findParentId', () => {
  const layout = {
    a: {
      id: 'a',
      children: ['b', 'r', 'k'],
    },
    b: {
      id: 'b',
      children: ['x', 'y', 'z'],
    },
    z: {
      id: 'z',
      children: [],
    },
  };
  it('should return the correct parentId', () => {
    expect(findParentId({ childId: 'b', layout })).toBe('a');
    expect(findParentId({ childId: 'z', layout })).toBe('b');
  });

  it('should return null if the parent cannot be found', () => {
    expect(findParentId({ childId: 'a', layout })).toBeNull();
  });
});

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

import { testWithId } from './testUtils';

describe('testUtils', () => {
  it('testWithId with prefix only', () => {
    expect(testWithId('prefix')()).toEqual({ 'data-test': 'prefix' });
  });

  it('testWithId with prefix only and idOnly', () => {
    expect(testWithId('prefix', true)()).toEqual('prefix');
  });

  it('testWithId with id only', () => {
    expect(testWithId()('id')).toEqual({ 'data-test': 'id' });
  });

  it('testWithId with id only and idOnly', () => {
    expect(testWithId(undefined, true)('id')).toEqual('id');
  });

  it('testWithId with prefix and id', () => {
    expect(testWithId('prefix')('id')).toEqual({ 'data-test': 'prefix__id' });
  });

  it('testWithId with prefix and id and idOnly', () => {
    expect(testWithId('prefix', true)('id')).toEqual('prefix__id');
  });

  it('testWithId without prefix and id', () => {
    expect(testWithId()()).toEqual({ 'data-test': '' });
  });

  it('testWithId without prefix and id and idOnly', () => {
    expect(testWithId(undefined, true)()).toEqual('');
  });
});

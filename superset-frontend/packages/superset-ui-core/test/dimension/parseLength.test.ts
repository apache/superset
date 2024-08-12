/*
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

import { parseLength } from '@superset-ui/core';

describe('parseLength(input)', () => {
  it('handles string "auto"', () => {
    expect(parseLength('auto')).toEqual({ isDynamic: true, multiplier: 1 });
  });

  it('handles strings with % at the end', () => {
    expect(parseLength('100%')).toEqual({ isDynamic: true, multiplier: 1 });
    expect(parseLength('50%')).toEqual({ isDynamic: true, multiplier: 0.5 });
    expect(parseLength('0%')).toEqual({ isDynamic: true, multiplier: 0 });
  });

  it('handles strings that are numbers with px at the end', () => {
    expect(parseLength('100px')).toEqual({ isDynamic: false, value: 100 });
    expect(parseLength('20.5px')).toEqual({ isDynamic: false, value: 20.5 });
  });

  it('handles strings that are numbers', () => {
    expect(parseLength('100')).toEqual({ isDynamic: false, value: 100 });
    expect(parseLength('40.5')).toEqual({ isDynamic: false, value: 40.5 });
    expect(parseLength('20.0')).toEqual({ isDynamic: false, value: 20 });
  });

  it('handles numbers', () => {
    expect(parseLength(100)).toEqual({ isDynamic: false, value: 100 });
    expect(parseLength(0)).toEqual({ isDynamic: false, value: 0 });
  });
});

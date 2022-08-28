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

import * as html from '../../src/helpers/html';

describe('html', () => {
  describe('showIf', () => {
    it('should return empty if param is false', () => {
      expect(html.showIf(false)).toEqual('hidden');
    });

    it('should return hidden if param is true', () => {
      expect(html.showIf(true)).toEqual('');
    });

    it('should return empty for a random param', () => {
      expect(html.showIf('random')).toEqual('');
    });
  });

  describe('hideIf', () => {
    it('should return empty if param is false', () => {
      expect(html.hideIf(false)).toEqual('');
    });

    it('should return hidden if param is true', () => {
      expect(html.hideIf(true)).toEqual('hidden');
    });

    it('should return hidden for a random param', () => {
      expect(html.hideIf('random')).toEqual('hidden');
    });
  });

  describe('selectedIf', () => {
    it('should return empty if param is false', () => {
      expect(html.selectedIf(false)).toEqual('');
    });

    it('should return hidden if param is true', () => {
      expect(html.selectedIf(true)).toEqual('selected');
    });

    it('should return empty for a random param', () => {
      expect(html.selectedIf('random')).toEqual('selected');
    });
  });

  describe('checkedIf', () => {
    it('should return empty if param is false', () => {
      expect(html.checkedIf(false)).toEqual('');
    });

    it('should return hidden if param is true', () => {
      expect(html.checkedIf(true)).toEqual('checked');
    });

    it('should return empty for a random param', () => {
      expect(html.checkedIf('random')).toEqual('checked');
    });
  });
});

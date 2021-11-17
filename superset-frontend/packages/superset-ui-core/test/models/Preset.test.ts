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

import { Plugin, Preset } from '@superset-ui/core/src';

describe('Preset', () => {
  it('exists', () => {
    expect(Preset).toBeDefined();
  });

  describe('new Preset()', () => {
    it('creates new preset', () => {
      const preset = new Preset();
      expect(preset).toBeInstanceOf(Preset);
    });
  });

  describe('.register()', () => {
    it('register all listed presets then plugins', () => {
      const values: number[] = [];
      class Plugin1 extends Plugin {
        register() {
          values.push(1);

          return this;
        }
      }
      class Plugin2 extends Plugin {
        register() {
          values.push(2);

          return this;
        }
      }
      class Plugin3 extends Plugin {
        register() {
          values.push(3);

          return this;
        }
      }
      class Plugin4 extends Plugin {
        register() {
          const { key } = this.config;
          values.push(key as number);

          return this;
        }
      }

      const preset1 = new Preset({
        plugins: [new Plugin1()],
      });
      const preset2 = new Preset({
        plugins: [new Plugin2()],
      });
      const preset3 = new Preset({
        presets: [preset1, preset2],
        plugins: [new Plugin3(), new Plugin4().configure({ key: 9 })],
      });
      preset3.register();
      expect(values).toEqual([1, 2, 3, 9]);
    });

    it('returns itself', () => {
      const preset = new Preset();
      expect(preset.register()).toBe(preset);
    });
  });
});

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

import { ExtensibleFunction } from '@superset-ui/core';

describe('ExtensibleFunction', () => {
  interface Func1 {
    (): number;
  }

  class Func1 extends ExtensibleFunction {
    constructor(x: unknown) {
      super(() => x); // closure
    }
  }

  interface Func2 {
    (): number;
  }

  class Func2 extends ExtensibleFunction {
    x: unknown;

    constructor(x: unknown) {
      super(() => this.x); // arrow function, refer to its own field
      this.x = x;
    }

    // eslint-disable-next-line class-methods-use-this
    hi() {
      return 'hi';
    }
  }

  class Func3 extends ExtensibleFunction {
    x: unknown;

    constructor(x: unknown) {
      // @ts-ignore
      super(function customName() {
        // @ts-ignore
        return customName.x as unknown;
      }); // named function
      this.x = x;
    }
  }

  it('its subclass is an instance of Function', () => {
    expect(Func1).toBeInstanceOf(Function);
    expect(Func2).toBeInstanceOf(Function);
    expect(Func3).toBeInstanceOf(Function);
  });

  const func1 = new Func1(100);
  const func2 = new Func2(100);
  const func3 = new Func3(100);

  it('an instance of its subclass is executable like regular function', () => {
    expect(func1()).toEqual(100);
    expect(func2()).toEqual(100);
  });

  it('its subclass behaves like regular class with its own fields and functions', () => {
    expect(func2.x).toEqual(100);
    expect(func2.hi()).toEqual('hi');
  });

  it('its subclass can set name by passing named function to its constructor', () => {
    expect(func3.name).toEqual('customName');
  });
});

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
import { safeStringify } from '../../../src/utils/safeStringify';

class Noise {
  public next: Noise;
}

describe('Stringify utility testing', () => {
  it('correctly parses a simple object just like JSON', () => {
    const noncircular = {
      b: 'foo',
      c: 'bar',
      d: [
        {
          e: 'hello',
          f: ['world'],
        },
        {
          e: 'hello',
          f: ['darkness', 'my', 'old', 'friend'],
        },
      ],
    };
    expect(safeStringify(noncircular)).toEqual(JSON.stringify(noncircular));
    // Checking that it works with quick-deepish-copies as well.
    expect(JSON.parse(safeStringify(noncircular))).toEqual(
      JSON.parse(JSON.stringify(noncircular)),
    );
  });

  it('handles simple circular json as expected', () => {
    const ping = new Noise();
    const pong = new Noise();
    const pang = new Noise();
    ping.next = pong;
    pong.next = ping;

    // ping.next is pong (the circular reference) now
    const safeString = safeStringify(ping);
    ping.next = pang;

    // ping.next is pang now, which has no circular reference, so it's safe to use JSON.stringify
    const ordinaryString = JSON.stringify(ping);
    expect(safeString).toEqual(ordinaryString);
  });

  it('creates a parseable object even when the input is circular', () => {
    const ping = new Noise();
    const pong = new Noise();
    ping.next = pong;
    pong.next = ping;

    const newNoise: Noise = JSON.parse(safeStringify(ping));
    expect(newNoise).toBeTruthy();
    expect(newNoise.next).toEqual({});
  });

  it('does not remove noncircular duplicates', () => {
    const a = {
      foo: 'bar',
    };

    const repeating = {
      first: a,
      second: a,
      third: a,
    };

    expect(safeStringify(repeating)).toEqual(JSON.stringify(repeating));
  });

  it('does not remove nodes with empty objects', () => {
    const emptyObjectValues = {
      a: {},
      b: 'foo',
      c: {
        d: 'good data here',
        e: {},
      },
    };
    expect(safeStringify(emptyObjectValues)).toEqual(
      JSON.stringify(emptyObjectValues),
    );
  });

  it('does not remove nested same keys', () => {
    const nestedKeys = {
      a: 'b',
      c: {
        a: 'd',
        x: 'y',
      },
    };

    expect(safeStringify(nestedKeys)).toEqual(JSON.stringify(nestedKeys));
  });
});

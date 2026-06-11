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
import {
  getTimeFormatterRegistry,
  SMART_DATE_ID,
  createSmartDateFormatter,
} from '@superset-ui/core';

import {
  computeYDomain,
  generateAnnotationTooltipContent,
  generateBubbleTooltipContent,
  generateMultiLineTooltipContent,
  getTimeOrNumberFormatter,
  formatLabel,
  tipFactory,
} from '../src/utils';

const DATA = [
  {
    key: ['East Asia & Pacific'],
    values: [
      {
        x: -315619200000.0,
        y: 1031863394.0,
      },
      {
        x: -283996800000.0,
        y: 1034767718.0,
      },
    ],
  },
  {
    key: ['South Asia'],
    values: [
      {
        x: -315619200000.0,
        y: 572036107.0,
      },
      {
        x: -283996800000.0,
        y: 584143236.0,
      },
    ],
  },
  {
    key: ['Europe & Central Asia'],
    values: [
      {
        x: -315619200000.0,
        y: 660881033.0,
      },
      {
        x: -283996800000.0,
        y: 668526708.0,
      },
    ],
  },
];

const DATA_WITH_DISABLED_SERIES = [
  {
    disabled: true,
    key: ['East Asia & Pacific'],
    values: [
      {
        x: -315619200000.0,
        y: 1031863394.0,
      },
      {
        x: -283996800000.0,
        y: 1034767718.0,
      },
    ],
  },
  {
    disabled: true,
    key: ['South Asia'],
    values: [
      {
        x: -315619200000.0,
        y: 572036107.0,
      },
      {
        x: -283996800000.0,
        y: 584143236.0,
      },
    ],
  },
  {
    key: ['Europe & Central Asia'],
    values: [
      {
        x: -315619200000.0,
        y: 660881033.0,
      },
      {
        x: -283996800000.0,
        y: 668526708.0,
      },
    ],
  },
];

describe('nvd3/utils', () => {
  beforeEach(() => {
    getTimeFormatterRegistry().registerValue(
      SMART_DATE_ID,
      createSmartDateFormatter(),
    );
  });

  describe('generateMultiLineTooltipContent()', () => {
    const identity = (value: any) => value;

    test('renders the series key in the tooltip markup', () => {
      const tooltip = generateMultiLineTooltipContent(
        {
          value: 'x-value',
          series: [{ key: 'Region A', color: '#fff', value: 1 }],
        },
        identity,
        [identity],
      );
      expect(tooltip).toContain('Region A');
    });

    test('strips a script payload from a malicious series key', () => {
      const tooltip = generateMultiLineTooltipContent(
        {
          value: 'x-value',
          series: [
            {
              key: '<img src=x onerror="alert(1)">',
              color: '#fff',
              value: 1,
            },
          ],
        },
        identity,
        [identity],
      );
      // DOMPurify removes the event handler that would execute on render.
      expect(tooltip).not.toContain('onerror');
      expect(tooltip).not.toContain('alert(1)');
    });
  });

  describe('getTimeOrNumberFormatter(format)', () => {
    test('is a function', () => {
      expect(typeof getTimeOrNumberFormatter).toBe('function');
    });
    test('returns a date formatter if format is smart_date', () => {
      const time = new Date(Date.UTC(2018, 10, 21, 22, 11));
      // @ts-expect-error -- getTimeOrNumberFormatter doesn't distinguish return types; accepts Date at runtime
      expect(getTimeOrNumberFormatter('smart_date')(time)).toBe('10:11');
    });
    test('returns a number formatter otherwise', () => {
      expect(getTimeOrNumberFormatter('.3s')(3000000)).toBe('3.00M');
      expect(getTimeOrNumberFormatter(undefined)(3000100)).toBe('3M');
    });
  });

  describe('formatLabel()', () => {
    const verboseMap = {
      foo: 'Foo',
      bar: 'Bar',
    };

    test('formats simple labels', () => {
      expect(formatLabel('foo')).toBe('foo');
      expect(formatLabel(['foo'])).toBe('foo');
      expect(formatLabel(['foo', 'bar'])).toBe('foo, bar');
    });
    test('formats simple labels with lookups', () => {
      expect(formatLabel('foo', verboseMap)).toBe('Foo');
      expect(formatLabel('baz', verboseMap)).toBe('baz');
      expect(formatLabel(['foo'], verboseMap)).toBe('Foo');
      expect(formatLabel(['foo', 'bar', 'baz'], verboseMap)).toBe(
        'Foo, Bar, baz',
      );
    });
    test('deals with time shift properly', () => {
      expect(formatLabel(['foo', '1 hour offset'], verboseMap)).toBe(
        'Foo, 1 hour offset',
      );
      expect(
        formatLabel(['foo', 'bar', 'baz', '2 hours offset'], verboseMap),
      ).toBe('Foo, Bar, baz, 2 hours offset');
    });
  });

  describe('computeYDomain()', () => {
    test('works with invalid data', () => {
      expect(computeYDomain('foo')).toEqual([0, 1]);
    });

    test('works with all series enabled', () => {
      expect(computeYDomain(DATA)).toEqual([572036107.0, 1034767718.0]);
    });

    test('works with some series disabled', () => {
      expect(computeYDomain(DATA_WITH_DISABLED_SERIES)).toEqual([
        660881033.0, 668526708.0,
      ]);
    });
  });

  // ------------------------------------------------------------------
  // Tooltip HTML sanitisation (XSS regression).
  // Each helper below feeds user-controlled column values into a
  // d3 / nvd3 .html() sink; the sanitised return must strip dangerous
  // markup so a stored payload cannot execute on hover.
  // ------------------------------------------------------------------

  describe('generateBubbleTooltipContent() sanitises user input', () => {
    test('strips <script> from the entity column', () => {
      const html = generateBubbleTooltipContent({
        point: {
          color: 'red',
          group: 'g',
          entity: '<script>alert(1)</script>',
          x: 1,
          y: 2,
          size: 3,
        },
        entity: 'entity',
        xField: 'x',
        yField: 'y',
        sizeField: 'size',
        xFormatter: (v: number) => String(v),
        yFormatter: (v: number) => String(v),
        sizeFormatter: (v: number) => String(v),
      });
      expect(html).not.toMatch(/<script/i);
      expect(html).not.toMatch(/onerror=/i);
    });

    test('strips <img onerror> injected via the group column', () => {
      const html = generateBubbleTooltipContent({
        point: {
          color: 'red',
          group: '<img src=x onerror=alert(1)>',
          entity: 'safe',
          x: 1,
          y: 2,
          size: 3,
        },
        entity: 'entity',
        xField: 'x',
        yField: 'y',
        sizeField: 'size',
        xFormatter: (v: number) => String(v),
        yFormatter: (v: number) => String(v),
        sizeFormatter: (v: number) => String(v),
      });
      expect(html).not.toMatch(/onerror/i);
    });
  });

  describe('generateMultiLineTooltipContent() sanitises user input', () => {
    test('strips <script> from a series key', () => {
      const html = generateMultiLineTooltipContent(
        {
          value: 0,
          series: [
            {
              key: '<script>alert(1)</script>',
              color: 'red',
              value: 1,
            },
          ],
        },
        (v: number) => String(v),
        [(v: number) => String(v)],
      );
      expect(html).not.toMatch(/<script/i);
    });
  });

  describe('tipFactory() sanitises annotation columns', () => {
    test('strips <script> from a description column value', () => {
      const tip = tipFactory({
        annotationTipClass: 'foo',
        titleColumn: 'title',
        descriptionColumns: ['desc'],
        name: 'layer',
      });
      // d3-tip's .html(fn) stores the callback as the renderer; invoke
      // it directly to assert the sanitised output.
      const datum = {
        title: 'normal',
        desc: '<script>alert(1)</script>payload',
      };
      const html = tip.html()(datum);
      expect(html).not.toMatch(/<script/i);
      expect(html).toContain('payload');
    });
  });

  describe('generateAnnotationTooltipContent()', () => {
    const layer = {
      name: 'My annotations',
      titleColumn: 'title',
      descriptionColumns: ['description'],
    };

    test('renders the annotation title and description', () => {
      const html = generateAnnotationTooltipContent(layer, {
        title: 'Release',
        description: 'Shipped v1',
      });
      expect(html).toContain('Release - My annotations');
      expect(html).toContain('Shipped v1');
    });

    test('falls back to the layer name when the title column is empty', () => {
      const html = generateAnnotationTooltipContent(layer, {
        title: '',
        description: 'Shipped v1',
      });
      expect(html).toContain('My annotations');
    });

    test('strips an event-handler payload from the title column', () => {
      const html = generateAnnotationTooltipContent(layer, {
        title: '<img src=x onerror="alert(1)">',
        description: 'ok',
      });
      expect(html).not.toContain('onerror');
      expect(html).not.toContain('alert(1)');
    });

    test('strips a script payload from a description column', () => {
      const html = generateAnnotationTooltipContent(layer, {
        title: 'Release',
        description: '<script>alert(document.cookie)</script>',
      });
      expect(html).not.toContain('<script>');
    });
  });
});

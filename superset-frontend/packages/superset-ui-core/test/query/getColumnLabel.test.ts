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
  getColumnLabel,
  getLocalizedColumnLabel,
  buildLocalizedColumnLabelMap,
} from '@superset-ui/core';
import type { AdhocColumn } from '@superset-ui/core';

const ADHOC_COLUMN_WITH_TRANSLATIONS: AdhocColumn = {
  expressionType: 'SQL',
  sqlExpression: 'order_date',
  label: 'Order Date',
  hasCustomLabel: true,
  translations: {
    label: {
      de: 'Bestelldatum',
      ru: 'Дата заказа',
      'de-DE': 'Bestelldatum (Deutschland)',
    },
  },
};

const ADHOC_COLUMN_WITHOUT_TRANSLATIONS: AdhocColumn = {
  expressionType: 'SQL',
  sqlExpression: 'customer_name',
  label: 'Customer Name',
  hasCustomLabel: true,
};

describe('getColumnLabel', () => {
  test('should handle physical column', () => {
    expect(getColumnLabel('gender')).toEqual('gender');
  });

  test('should handle adhoc columns with label', () => {
    expect(
      getColumnLabel({
        sqlExpression: "case when 1 then 'a' else 'b' end",
        label: 'my col',
        expressionType: 'SQL',
      }),
    ).toEqual('my col');
  });

  test('should handle adhoc columns without label', () => {
    expect(
      getColumnLabel({
        sqlExpression: "case when 1 then 'a' else 'b' end",
        expressionType: 'SQL',
      }),
    ).toEqual("case when 1 then 'a' else 'b' end");
  });
});

describe('getLocalizedColumnLabel', () => {
  test('returns localized label for exact locale match', () => {
    expect(getLocalizedColumnLabel(ADHOC_COLUMN_WITH_TRANSLATIONS, 'de')).toBe(
      'Bestelldatum',
    );
    expect(getLocalizedColumnLabel(ADHOC_COLUMN_WITH_TRANSLATIONS, 'ru')).toBe(
      'Дата заказа',
    );
  });

  test('returns exact locale match over base language', () => {
    expect(
      getLocalizedColumnLabel(ADHOC_COLUMN_WITH_TRANSLATIONS, 'de-DE'),
    ).toBe('Bestelldatum (Deutschland)');
  });

  test('falls back to base language when exact locale not found', () => {
    expect(
      getLocalizedColumnLabel(ADHOC_COLUMN_WITH_TRANSLATIONS, 'de-AT'),
    ).toBe('Bestelldatum');
  });

  test('returns original label when locale not in translations', () => {
    expect(getLocalizedColumnLabel(ADHOC_COLUMN_WITH_TRANSLATIONS, 'fr')).toBe(
      'Order Date',
    );
  });

  test('returns original label when no translations', () => {
    expect(
      getLocalizedColumnLabel(ADHOC_COLUMN_WITHOUT_TRANSLATIONS, 'de'),
    ).toBe('Customer Name');
  });

  test('returns original label when no locale provided', () => {
    expect(
      getLocalizedColumnLabel(ADHOC_COLUMN_WITH_TRANSLATIONS, undefined),
    ).toBe('Order Date');
  });

  test('returns physical column as-is (no translations possible)', () => {
    expect(getLocalizedColumnLabel('order_date', 'de')).toBe('order_date');
  });
});

describe('buildLocalizedColumnLabelMap', () => {
  test('builds map from original to localized labels', () => {
    const columns = [
      ADHOC_COLUMN_WITH_TRANSLATIONS,
      {
        ...ADHOC_COLUMN_WITHOUT_TRANSLATIONS,
        label: 'Product Name',
        translations: { label: { de: 'Produktname' } },
      } as AdhocColumn,
    ];
    const map = buildLocalizedColumnLabelMap(columns, 'de');

    expect(map).toEqual({
      'Order Date': 'Bestelldatum',
      'Product Name': 'Produktname',
    });
  });

  test('excludes columns without translations for given locale', () => {
    const columns = [
      ADHOC_COLUMN_WITH_TRANSLATIONS,
      ADHOC_COLUMN_WITHOUT_TRANSLATIONS,
    ];
    const map = buildLocalizedColumnLabelMap(columns, 'de');

    expect(map).toEqual({
      'Order Date': 'Bestelldatum',
    });
    expect(map['Customer Name']).toBeUndefined();
  });

  test('returns empty map when no locale', () => {
    const columns = [ADHOC_COLUMN_WITH_TRANSLATIONS];
    const map = buildLocalizedColumnLabelMap(columns, undefined);

    expect(map).toEqual({});
  });

  test('returns empty map when columns undefined', () => {
    const map = buildLocalizedColumnLabelMap(undefined, 'de');

    expect(map).toEqual({});
  });

  test('returns empty map when columns empty', () => {
    const map = buildLocalizedColumnLabelMap([], 'de');

    expect(map).toEqual({});
  });

  test('excludes physical columns (strings)', () => {
    const columns = ['order_date', ADHOC_COLUMN_WITH_TRANSLATIONS];
    const map = buildLocalizedColumnLabelMap(columns, 'de');

    expect(map).toEqual({
      'Order Date': 'Bestelldatum',
    });
    expect(map['order_date']).toBeUndefined();
  });
});

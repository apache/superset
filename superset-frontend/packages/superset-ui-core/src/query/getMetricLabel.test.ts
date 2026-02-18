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
import getMetricLabel, {
  getLocalizedMetricLabel,
  buildLocalizedMetricLabelMap,
} from './getMetricLabel';
import { AdhocMetricSQL, AdhocMetricSimple } from './types';

const METRIC_WITH_TRANSLATIONS: AdhocMetricSQL = {
  expressionType: 'SQL',
  sqlExpression: 'SUM(revenue)',
  label: 'Total Revenue',
  hasCustomLabel: true,
  translations: {
    label: {
      de: 'Gesamtumsatz',
      ru: 'Общий доход',
      'de-DE': 'Gesamtumsatz (Deutschland)',
    },
  },
};

const METRIC_WITHOUT_TRANSLATIONS: AdhocMetricSQL = {
  expressionType: 'SQL',
  sqlExpression: 'COUNT(*)',
  label: 'Row Count',
  hasCustomLabel: true,
};

const SIMPLE_METRIC: AdhocMetricSimple = {
  expressionType: 'SIMPLE',
  column: { column_name: 'price' },
  aggregate: 'AVG',
  label: 'Average Price',
  hasCustomLabel: true,
  translations: {
    label: {
      de: 'Durchschnittspreis',
    },
  },
};

describe('getMetricLabel', () => {
  test('returns saved metric name as-is', () => {
    expect(getMetricLabel('sum__revenue')).toBe('sum__revenue');
  });

  test('returns custom label when present', () => {
    expect(getMetricLabel(METRIC_WITH_TRANSLATIONS)).toBe('Total Revenue');
  });

  test('returns SQL expression when no label', () => {
    const metric: AdhocMetricSQL = {
      expressionType: 'SQL',
      sqlExpression: 'SUM(revenue)',
    };
    expect(getMetricLabel(metric)).toBe('SUM(revenue)');
  });

  test('returns aggregate(column) for simple metric without label', () => {
    const metric: AdhocMetricSimple = {
      expressionType: 'SIMPLE',
      column: { column_name: 'price' },
      aggregate: 'SUM',
    };
    expect(getMetricLabel(metric)).toBe('SUM(price)');
  });
});

describe('getLocalizedMetricLabel', () => {
  test('returns localized label for exact locale match', () => {
    expect(getLocalizedMetricLabel(METRIC_WITH_TRANSLATIONS, 'de')).toBe(
      'Gesamtumsatz',
    );
    expect(getLocalizedMetricLabel(METRIC_WITH_TRANSLATIONS, 'ru')).toBe(
      'Общий доход',
    );
  });

  test('returns exact locale match over base language', () => {
    expect(getLocalizedMetricLabel(METRIC_WITH_TRANSLATIONS, 'de-DE')).toBe(
      'Gesamtumsatz (Deutschland)',
    );
  });

  test('falls back to base language when exact locale not found', () => {
    expect(getLocalizedMetricLabel(METRIC_WITH_TRANSLATIONS, 'de-AT')).toBe(
      'Gesamtumsatz',
    );
  });

  test('returns original label when locale not in translations', () => {
    expect(getLocalizedMetricLabel(METRIC_WITH_TRANSLATIONS, 'fr')).toBe(
      'Total Revenue',
    );
  });

  test('returns original label when no translations', () => {
    expect(getLocalizedMetricLabel(METRIC_WITHOUT_TRANSLATIONS, 'de')).toBe(
      'Row Count',
    );
  });

  test('returns original label when no locale provided', () => {
    expect(getLocalizedMetricLabel(METRIC_WITH_TRANSLATIONS, undefined)).toBe(
      'Total Revenue',
    );
  });

  test('returns saved metric as-is (no translations possible)', () => {
    expect(getLocalizedMetricLabel('sum__revenue', 'de')).toBe('sum__revenue');
  });

  test('works with simple metric translations', () => {
    expect(getLocalizedMetricLabel(SIMPLE_METRIC, 'de')).toBe(
      'Durchschnittspreis',
    );
  });
});

describe('buildLocalizedMetricLabelMap', () => {
  test('builds map from original to localized labels', () => {
    const metrics = [METRIC_WITH_TRANSLATIONS, SIMPLE_METRIC];
    const map = buildLocalizedMetricLabelMap(metrics, 'de');

    expect(map).toEqual({
      'Total Revenue': 'Gesamtumsatz',
      'Average Price': 'Durchschnittspreis',
    });
  });

  test('excludes metrics without translations for given locale', () => {
    const metrics = [METRIC_WITH_TRANSLATIONS, METRIC_WITHOUT_TRANSLATIONS];
    const map = buildLocalizedMetricLabelMap(metrics, 'de');

    expect(map).toEqual({
      'Total Revenue': 'Gesamtumsatz',
    });
    expect(map['Row Count']).toBeUndefined();
  });

  test('returns empty map when no locale', () => {
    const metrics = [METRIC_WITH_TRANSLATIONS];
    const map = buildLocalizedMetricLabelMap(metrics, undefined);

    expect(map).toEqual({});
  });

  test('returns empty map when metrics undefined', () => {
    const map = buildLocalizedMetricLabelMap(undefined, 'de');

    expect(map).toEqual({});
  });

  test('returns empty map when metrics empty', () => {
    const map = buildLocalizedMetricLabelMap([], 'de');

    expect(map).toEqual({});
  });

  test('excludes saved metrics (strings)', () => {
    const metrics = ['sum__revenue', METRIC_WITH_TRANSLATIONS];
    const map = buildLocalizedMetricLabelMap(metrics, 'de');

    expect(map).toEqual({
      'Total Revenue': 'Gesamtumsatz',
    });
    expect(map['sum__revenue']).toBeUndefined();
  });
});

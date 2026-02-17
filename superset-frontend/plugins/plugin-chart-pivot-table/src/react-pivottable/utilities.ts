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

import PropTypes from 'prop-types';
import { t } from '@apache-superset/core/ui';

type SortFunction = (
  a: string | number | null,
  b: string | number | null,
) => number;
type Formatter = (x: number) => string;
type PivotRecord = Record<string, string | number | boolean>;

interface NumberFormatOptions {
  digitsAfterDecimal?: number;
  scaler?: number;
  thousandsSep?: string;
  decimalSep?: string;
  prefix?: string;
  suffix?: string;
}

interface Aggregator {
  push(record: PivotRecord): void;
  value(): string | number | null;
  format(x: string | number | null, agg?: Aggregator): string;
  numInputs?: number;
  getCurrencies?(): string[];
  isSubtotal?: boolean;
  isRowSubtotal?: boolean;
  isColSubtotal?: boolean;
}

interface SubtotalOptions {
  rowEnabled?: boolean;
  colEnabled?: boolean;
  rowPartialOnTop?: boolean;
  colPartialOnTop?: boolean;
}

const addSeparators = function (
  nStr: string,
  thousandsSep: string,
  decimalSep: string,
): string {
  const x = String(nStr).split('.');
  let x1 = x[0];
  const x2 = x.length > 1 ? decimalSep + x[1] : '';
  const rgx = /(\d+)(\d{3})/;
  while (rgx.test(x1)) {
    x1 = x1.replace(rgx, `$1${thousandsSep}$2`);
  }
  return x1 + x2;
};

const numberFormat = function (optsIn?: NumberFormatOptions): Formatter {
  const defaults = {
    digitsAfterDecimal: 2,
    scaler: 1,
    thousandsSep: ',',
    decimalSep: '.',
    prefix: '',
    suffix: '',
  };
  const opts = { ...defaults, ...optsIn };
  return function (x: number): string {
    if (Number.isNaN(x) || !Number.isFinite(x)) {
      return '';
    }
    const result = addSeparators(
      (opts.scaler * x).toFixed(opts.digitsAfterDecimal),
      opts.thousandsSep,
      opts.decimalSep,
    );
    return `${opts.prefix}${result}${opts.suffix}`;
  };
};

const rx = /(\d+)|(\D+)/g;
const rd = /\d/;
const rz = /^0/;
const naturalSort: SortFunction = (as, bs) => {
  // nulls first
  if (bs !== null && as === null) {
    return -1;
  }
  if (as !== null && bs === null) {
    return 1;
  }

  // then raw NaNs
  if (typeof as === 'number' && Number.isNaN(as)) {
    return -1;
  }
  if (typeof bs === 'number' && Number.isNaN(bs)) {
    return 1;
  }

  // numbers and numbery strings group together
  const nas = Number(as);
  const nbs = Number(bs);
  if (nas < nbs) {
    return -1;
  }
  if (nas > nbs) {
    return 1;
  }

  // within that, true numbers before numbery strings
  if (typeof as === 'number' && typeof bs !== 'number') {
    return -1;
  }
  if (typeof bs === 'number' && typeof as !== 'number') {
    return 1;
  }
  if (typeof as === 'number' && typeof bs === 'number') {
    return 0;
  }

  // 'Infinity' is a textual number, so less than 'A'
  if (Number.isNaN(nbs) && !Number.isNaN(nas)) {
    return -1;
  }
  if (Number.isNaN(nas) && !Number.isNaN(nbs)) {
    return 1;
  }

  // finally, "smart" string sorting per http://stackoverflow.com/a/4373421/112871
  const a = String(as);
  const b = String(bs);
  if (a === b) {
    return 0;
  }
  if (!rd.test(a) || !rd.test(b)) {
    return a > b ? 1 : -1;
  }

  // special treatment for strings containing digits
  const aArr = a.match(rx)!;
  const bArr = b.match(rx)!;
  while (aArr.length && bArr.length) {
    const a1 = aArr.shift()!;
    const b1 = bArr.shift()!;
    if (a1 !== b1) {
      if (rd.test(a1) && rd.test(b1)) {
        return Number(a1.replace(rz, '.0')) - Number(b1.replace(rz, '.0'));
      }
      return a1 > b1 ? 1 : -1;
    }
  }
  return aArr.length - bArr.length;
};

const sortAs = function (order: (string | number)[]): SortFunction {
  const mapping: Record<string | number, number> = {};

  // sort lowercased keys similarly
  const lMapping: Record<string, number> = {};
  order.forEach((element: string | number, i: number) => {
    mapping[element] = i;
    if (typeof element === 'string') {
      lMapping[element.toLowerCase()] = i;
    }
  });
  return function (
    a: string | number | null,
    b: string | number | null,
  ): number {
    const aKey = a !== null ? String(a) : '';
    const bKey = b !== null ? String(b) : '';
    if (aKey in mapping && bKey in mapping) {
      return mapping[aKey] - mapping[bKey];
    }
    if (aKey in mapping) {
      return -1;
    }
    if (bKey in mapping) {
      return 1;
    }
    if (aKey in lMapping && bKey in lMapping) {
      return lMapping[aKey] - lMapping[bKey];
    }
    if (aKey in lMapping) {
      return -1;
    }
    if (bKey in lMapping) {
      return 1;
    }
    return naturalSort(a, b);
  };
};

const getSort = function (
  sorters:
    | ((attr: string) => SortFunction | undefined)
    | Record<string, SortFunction>
    | null
    | undefined,
  attr: string,
): SortFunction {
  if (sorters) {
    if (typeof sorters === 'function') {
      const sort = sorters(attr);
      if (typeof sort === 'function') {
        return sort;
      }
    } else if (attr in sorters) {
      return sorters[attr];
    }
  }
  return naturalSort;
};

// aggregator templates default to US number formatting but this is overridable
const usFmt = numberFormat();
const usFmtInt = numberFormat({ digitsAfterDecimal: 0 });
const usFmtPct = numberFormat({
  digitsAfterDecimal: 1,
  scaler: 100,
  suffix: '%',
});

const fmtNonString =
  (formatter: Formatter) =>
  (x: string | number | null): string =>
    typeof x === 'string' ? x : formatter(x as number);

/*
 * Aggregators track currencies via push() and expose them via getCurrencies()
 * for per-cell currency detection in AUTO mode.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
const baseAggregatorTemplates = {
  count(formatter = usFmtInt) {
    return () =>
      function () {
        return {
          count: 0,
          push() {
            this.count += 1;
          },
          value() {
            return this.count;
          },
          format: formatter,
        };
      };
  },

  uniques(fn: (uniq: any[]) => any, formatter = usFmtInt) {
    return function ([attr]: string[]) {
      return function () {
        return {
          uniq: [] as any[],
          currencySet: new Set<string>(),
          push(record: PivotRecord) {
            if (!Array.from(this.uniq).includes(record[attr])) {
              this.uniq.push(record[attr]);
            }
            if (
              record.__currencyColumn &&
              record[record.__currencyColumn as string]
            ) {
              this.currencySet.add(
                String(record[record.__currencyColumn as string]),
              );
            }
          },
          value() {
            return fn(this.uniq);
          },
          getCurrencies() {
            return Array.from(this.currencySet);
          },
          format: fmtNonString(formatter),
          numInputs: typeof attr !== 'undefined' ? 0 : 1,
        };
      };
    };
  },

  sum(formatter = usFmt) {
    return function ([attr]: string[]) {
      return function () {
        return {
          sum: 0 as any,
          currencySet: new Set<string>(),
          push(record: PivotRecord) {
            if (Number.isNaN(Number(record[attr]))) {
              this.sum = record[attr];
            } else {
              this.sum += parseFloat(String(record[attr]));
            }
            if (
              record.__currencyColumn &&
              record[record.__currencyColumn as string]
            ) {
              this.currencySet.add(
                String(record[record.__currencyColumn as string]),
              );
            }
          },
          value() {
            return this.sum;
          },
          getCurrencies() {
            return Array.from(this.currencySet);
          },
          format: fmtNonString(formatter),
          numInputs: typeof attr !== 'undefined' ? 0 : 1,
        };
      };
    };
  },

  extremes(mode: string, formatter = usFmt) {
    return function ([attr]: string[]) {
      return function (data: any) {
        return {
          val: null as any,
          currencySet: new Set<string>(),
          sorter: getSort(
            typeof data !== 'undefined' ? data.sorters : null,
            attr,
          ),
          push(record: PivotRecord) {
            const x = record[attr];
            if (['min', 'max'].includes(mode)) {
              const coercedValue = Number(x);
              if (Number.isNaN(coercedValue)) {
                this.val =
                  !this.val ||
                  (mode === 'min' && x < this.val) ||
                  (mode === 'max' && x > this.val)
                    ? x
                    : this.val;
              } else {
                const mathFn = mode === 'min' ? Math.min : Math.max;
                this.val = mathFn(
                  coercedValue,
                  this.val !== null ? this.val : coercedValue,
                );
              }
            } else if (
              mode === 'first' &&
              this.sorter(
                x as any,
                this.val !== null ? this.val : (x as any),
              ) <= 0
            ) {
              this.val = x;
            } else if (
              mode === 'last' &&
              this.sorter(
                x as any,
                this.val !== null ? this.val : (x as any),
              ) >= 0
            ) {
              this.val = x;
            }
            if (
              record.__currencyColumn &&
              record[record.__currencyColumn as string]
            ) {
              this.currencySet.add(
                String(record[record.__currencyColumn as string]),
              );
            }
          },
          value() {
            return this.val;
          },
          getCurrencies() {
            return Array.from(this.currencySet);
          },
          format(x: any) {
            if (typeof x === 'number') {
              return formatter(x);
            }
            return x;
          },
          numInputs: typeof attr !== 'undefined' ? 0 : 1,
        };
      };
    };
  },

  quantile(q: number, formatter = usFmt) {
    return function ([attr]: string[]) {
      return function () {
        return {
          vals: [] as number[],
          strMap: {} as Record<string, number>,
          currencySet: new Set<string>(),
          push(record: PivotRecord) {
            const val = record[attr];
            const x = Number(val);

            if (Number.isNaN(x)) {
              this.strMap[String(val)] = (this.strMap[String(val)] || 0) + 1;
            } else {
              this.vals.push(x);
            }
            if (
              record.__currencyColumn &&
              record[record.__currencyColumn as string]
            ) {
              this.currencySet.add(
                String(record[record.__currencyColumn as string]),
              );
            }
          },
          value() {
            if (
              this.vals.length === 0 &&
              Object.keys(this.strMap).length === 0
            ) {
              return null;
            }

            if (Object.keys(this.strMap).length) {
              const values = (Object.values(this.strMap) as number[]).sort(
                (a: number, b: number) => a - b,
              );
              const middle = Math.floor(values.length / 2);

              const keys = Object.keys(this.strMap);
              return keys.length % 2 !== 0
                ? keys[middle]
                : (Number(keys[middle - 1]) + Number(keys[middle])) / 2;
            }

            this.vals.sort((a: number, b: number) => a - b);
            const i = (this.vals.length - 1) * q;
            return (this.vals[Math.floor(i)] + this.vals[Math.ceil(i)]) / 2.0;
          },
          getCurrencies() {
            return Array.from(this.currencySet);
          },
          format: fmtNonString(formatter),
          numInputs: typeof attr !== 'undefined' ? 0 : 1,
        };
      };
    };
  },

  runningStat(mode = 'mean', ddof = 1, formatter = usFmt) {
    return function ([attr]: string[]) {
      return function () {
        return {
          n: 0.0,
          m: 0.0,
          s: 0.0,
          strValue: null as string | null,
          currencySet: new Set<string>(),
          push(record: PivotRecord) {
            const x = Number(record[attr]);
            if (Number.isNaN(x)) {
              this.strValue =
                typeof record[attr] === 'string'
                  ? (record[attr] as string)
                  : this.strValue;
              if (
                record.__currencyColumn &&
                record[record.__currencyColumn as string]
              ) {
                this.currencySet.add(
                  String(record[record.__currencyColumn as string]),
                );
              }
              return;
            }
            this.n += 1.0;
            if (this.n === 1.0) {
              this.m = x;
            }
            const mNew = this.m + (x - this.m) / this.n;
            this.s += (x - this.m) * (x - mNew);
            this.m = mNew;
            if (
              record.__currencyColumn &&
              record[record.__currencyColumn as string]
            ) {
              this.currencySet.add(
                String(record[record.__currencyColumn as string]),
              );
            }
          },
          value() {
            if (this.strValue) {
              return this.strValue;
            }

            if (mode === 'mean') {
              if (this.n === 0) {
                return 0 / 0;
              }
              return this.m;
            }
            if (this.n <= ddof) {
              return 0;
            }
            switch (mode) {
              case 'var':
                return this.s / (this.n - ddof);
              case 'stdev':
                return Math.sqrt(this.s / (this.n - ddof));
              default:
                throw new Error('unknown mode for runningStat');
            }
          },
          getCurrencies() {
            return Array.from(this.currencySet);
          },
          format: fmtNonString(formatter),
          numInputs: typeof attr !== 'undefined' ? 0 : 1,
        };
      };
    };
  },

  sumOverSum(formatter = usFmt) {
    return function ([num, denom]: string[]) {
      return function () {
        return {
          sumNum: 0,
          sumDenom: 0,
          currencySet: new Set<string>(),
          push(record: PivotRecord) {
            if (!Number.isNaN(Number(record[num]))) {
              this.sumNum += parseFloat(String(record[num]));
            }
            if (!Number.isNaN(Number(record[denom]))) {
              this.sumDenom += parseFloat(String(record[denom]));
            }
            if (
              record.__currencyColumn &&
              record[record.__currencyColumn as string]
            ) {
              this.currencySet.add(
                String(record[record.__currencyColumn as string]),
              );
            }
          },
          value() {
            return this.sumNum / this.sumDenom;
          },
          getCurrencies() {
            return Array.from(this.currencySet);
          },
          format: formatter,
          numInputs:
            typeof num !== 'undefined' && typeof denom !== 'undefined' ? 0 : 2,
        };
      };
    };
  },

  fractionOf(
    wrapped: (...args: any[]) => any,
    type = 'total',
    formatter = usFmtPct,
  ) {
    return (...x: any[]) =>
      function (data: any, rowKey: any, colKey: any) {
        return {
          selector: { total: [[], []], row: [rowKey, []], col: [[], colKey] }[
            type
          ],
          inner: wrapped(...Array.from(x || []))(data, rowKey, colKey),
          push(record: PivotRecord) {
            this.inner.push(record);
          },
          format: fmtNonString(formatter),
          value() {
            const acc = data
              .getAggregator(...Array.from(this.selector || []))
              .inner.value();

            if (typeof acc === 'string') {
              return acc;
            }

            return this.inner.value() / acc;
          },
          getCurrencies() {
            return this.inner.getCurrencies ? this.inner.getCurrencies() : [];
          },
          numInputs: wrapped(...Array.from(x || []))().numInputs,
        };
      };
  },
};
/* eslint-enable @typescript-eslint/no-explicit-any */

const extendedAggregatorTemplates = {
  countUnique(f?: Formatter) {
    return baseAggregatorTemplates.uniques((x: unknown[]) => x.length, f);
  },
  listUnique(s: string, f?: Formatter) {
    return baseAggregatorTemplates.uniques(
      (x: unknown[]) => x.join(s),
      f || (((x: unknown) => x) as unknown as Formatter),
    );
  },
  max(f?: Formatter) {
    return baseAggregatorTemplates.extremes('max', f);
  },
  min(f?: Formatter) {
    return baseAggregatorTemplates.extremes('min', f);
  },
  first(f?: Formatter) {
    return baseAggregatorTemplates.extremes('first', f);
  },
  last(f?: Formatter) {
    return baseAggregatorTemplates.extremes('last', f);
  },
  median(f?: Formatter) {
    return baseAggregatorTemplates.quantile(0.5, f);
  },
  average(f?: Formatter) {
    return baseAggregatorTemplates.runningStat('mean', 1, f);
  },
  var(ddof: number, f?: Formatter) {
    return baseAggregatorTemplates.runningStat('var', ddof, f);
  },
  stdev(ddof: number, f?: Formatter) {
    return baseAggregatorTemplates.runningStat('stdev', ddof, f);
  },
};

const aggregatorTemplates = {
  ...baseAggregatorTemplates,
  ...extendedAggregatorTemplates,
};

// default aggregators & renderers use US naming and number formatting
const aggregators = (tpl => ({
  Count: tpl.count(usFmtInt),
  'Count Unique Values': tpl.countUnique(usFmtInt),
  'List Unique Values': tpl.listUnique(', '),
  Sum: tpl.sum(usFmt),
  'Integer Sum': tpl.sum(usFmtInt),
  Average: tpl.average(usFmt),
  Median: tpl.median(usFmt),
  'Sample Variance': tpl.var(1, usFmt),
  'Sample Standard Deviation': tpl.stdev(1, usFmt),
  Minimum: tpl.min(usFmt),
  Maximum: tpl.max(usFmt),
  First: tpl.first(usFmt),
  Last: tpl.last(usFmt),
  'Sum over Sum': tpl.sumOverSum(usFmt),
  'Sum as Fraction of Total': tpl.fractionOf(tpl.sum(), 'total', usFmtPct),
  'Sum as Fraction of Rows': tpl.fractionOf(tpl.sum(), 'row', usFmtPct),
  'Sum as Fraction of Columns': tpl.fractionOf(tpl.sum(), 'col', usFmtPct),
  'Count as Fraction of Total': tpl.fractionOf(tpl.count(), 'total', usFmtPct),
  'Count as Fraction of Rows': tpl.fractionOf(tpl.count(), 'row', usFmtPct),
  'Count as Fraction of Columns': tpl.fractionOf(tpl.count(), 'col', usFmtPct),
}))(aggregatorTemplates);

const locales = {
  en: {
    aggregators,
    localeStrings: {
      renderError: 'An error occurred rendering the PivotTable results.',
      computeError: 'An error occurred computing the PivotTable results.',
      uiRenderError: 'An error occurred rendering the PivotTable UI.',
      selectAll: 'Select All',
      selectNone: 'Select None',
      tooMany: '(too many to list)',
      filterResults: 'Filter values',
      apply: 'Apply',
      cancel: 'Cancel',
      totals: 'Totals',
      vs: 'vs',
      by: 'by',
    },
  },
};

// dateFormat deriver l10n requires month and day names to be passed in directly
const mthNamesEn = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];
const dayNamesEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const zeroPad = (number: number): string => `0${number}`.substr(-2, 2); // eslint-disable-line no-magic-numbers

const derivers = {
  bin(col: string, binWidth: number) {
    return (record: PivotRecord) =>
      (record[col] as number) - ((record[col] as number) % binWidth);
  },
  dateFormat(
    col: string,
    formatString: string,
    utcOutput = false,
    mthNames = mthNamesEn,
    dayNames = dayNamesEn,
  ) {
    const utc = utcOutput ? 'UTC' : '';
    return function (record: PivotRecord) {
      const date = new Date(Date.parse(String(record[col])));
      if (Number.isNaN(date.getTime())) {
        return '';
      }
      return formatString.replace(
        /%(.)/g,
        function (m: string, p: string): string {
          switch (p) {
            case 'y':
              return String(date[`get${utc}FullYear`]());
            case 'm':
              return zeroPad(date[`get${utc}Month`]() + 1);
            case 'n':
              return mthNames[date[`get${utc}Month`]()];
            case 'd':
              return zeroPad(date[`get${utc}Date`]());
            case 'w':
              return dayNames[date[`get${utc}Day`]()];
            case 'x':
              return String(date[`get${utc}Day`]());
            case 'H':
              return zeroPad(date[`get${utc}Hours`]());
            case 'M':
              return zeroPad(date[`get${utc}Minutes`]());
            case 'S':
              return zeroPad(date[`get${utc}Seconds`]());
            default:
              return `%${p}`;
          }
        },
      );
    };
  },
};

// Given an array of attribute values, convert to a key that
// can be used in objects.
const flatKey = (attrVals: string[]): string =>
  attrVals.join(String.fromCharCode(0));

/*
Data Model class
*/

class PivotData {
  props: Record<string, unknown>;
  aggregator: (...args: unknown[]) => Aggregator;
  formattedAggregators:
    | Record<string, Record<string, (...args: unknown[]) => Aggregator>>
    | false;
  tree: Record<string, Record<string, Aggregator>>;
  rowKeys: string[][];
  colKeys: string[][];
  rowTotals: Record<string, Aggregator>;
  colTotals: Record<string, Aggregator>;
  allTotal: Aggregator;
  subtotals: SubtotalOptions;
  sorted: boolean;

  static forEachRecord: (
    input: unknown,
    processRecord: (record: PivotRecord) => void,
  ) => void;
  static defaultProps: Record<string, unknown>;
  static propTypes: Record<string, unknown>;

  constructor(
    inputProps: Record<string, unknown> = {},
    subtotals: SubtotalOptions = {},
  ) {
    this.props = { ...PivotData.defaultProps, ...inputProps };
    this.processRecord = this.processRecord.bind(this);
    PropTypes.checkPropTypes(
      PivotData.propTypes,
      this.props,
      'prop',
      'PivotData',
    );

    const aggregatorsFactory = this.props.aggregatorsFactory as (
      fmt: unknown,
    ) => Record<string, (vals: unknown) => (...args: unknown[]) => Aggregator>;
    const aggregatorName = this.props.aggregatorName as string;
    const vals = this.props.vals as string[];
    this.aggregator = aggregatorsFactory(this.props.defaultFormatter)[
      aggregatorName
    ](vals);
    this.formattedAggregators = this.props.customFormatters
      ? Object.entries(
          this.props.customFormatters as Record<
            string,
            Record<string, unknown>
          >,
        ).reduce(
          (
            acc: Record<
              string,
              Record<string, (...args: unknown[]) => Aggregator>
            >,
            [key, columnFormatter],
          ) => {
            acc[key] = {};
            Object.entries(columnFormatter).forEach(([column, formatter]) => {
              acc[key][column] =
                aggregatorsFactory(formatter)[aggregatorName](vals);
            });
            return acc;
          },
          {},
        )
      : false;
    this.tree = {};
    this.rowKeys = [];
    this.colKeys = [];
    this.rowTotals = {};
    this.colTotals = {};
    this.allTotal = this.aggregator(this, [], []);
    this.subtotals = subtotals;
    this.sorted = false;

    // iterate through input, accumulating data for cells
    PivotData.forEachRecord(this.props.data, this.processRecord);
  }

  getFormattedAggregator(record: PivotRecord, totalsKeys?: string[]) {
    if (!this.formattedAggregators) {
      return this.aggregator;
    }
    const fmtAggs = this.formattedAggregators;
    const [groupName, groupValue] =
      Object.entries(record).find(
        ([name, value]) => fmtAggs[name] && fmtAggs[name][String(value)],
      ) || [];
    if (
      !groupName ||
      !groupValue ||
      (totalsKeys && !totalsKeys.includes(String(groupValue)))
    ) {
      return this.aggregator;
    }
    return fmtAggs[groupName][String(groupValue)] || this.aggregator;
  }

  arrSort(attrs: string[], partialOnTop: boolean | undefined, reverse = false) {
    const sortersArr = attrs.map(a =>
      getSort(
        this.props.sorters as
          | ((attr: string) => SortFunction | undefined)
          | Record<string, SortFunction>
          | null,
        a,
      ),
    );
    return function (a: string[], b: string[]) {
      const limit = Math.min(a.length, b.length);
      for (let i = 0; i < limit; i += 1) {
        const sorter = sortersArr[i];
        const comparison = reverse ? sorter(b[i], a[i]) : sorter(a[i], b[i]);
        if (comparison !== 0) {
          return comparison;
        }
      }
      return partialOnTop ? a.length - b.length : b.length - a.length;
    };
  }

  sortKeys(): void {
    if (!this.sorted) {
      this.sorted = true;
      const rows = this.props.rows as string[];
      const cols = this.props.cols as string[];
      const v = (r: string[], c: string[]) => this.getAggregator(r, c).value();
      switch (this.props.rowOrder) {
        case 'key_z_to_a':
          this.rowKeys.sort(
            this.arrSort(rows, this.subtotals.rowPartialOnTop, true),
          );
          break;
        case 'value_a_to_z':
          this.rowKeys.sort((a, b) => naturalSort(v(a, []), v(b, [])));
          break;
        case 'value_z_to_a':
          this.rowKeys.sort((a, b) => -naturalSort(v(a, []), v(b, [])));
          break;
        default:
          this.rowKeys.sort(this.arrSort(rows, this.subtotals.rowPartialOnTop));
      }
      switch (this.props.colOrder) {
        case 'key_z_to_a':
          this.colKeys.sort(
            this.arrSort(cols, this.subtotals.colPartialOnTop, true),
          );
          break;
        case 'value_a_to_z':
          this.colKeys.sort((a, b) => naturalSort(v([], a), v([], b)));
          break;
        case 'value_z_to_a':
          this.colKeys.sort((a, b) => -naturalSort(v([], a), v([], b)));
          break;
        default:
          this.colKeys.sort(this.arrSort(cols, this.subtotals.colPartialOnTop));
      }
    }
  }

  getColKeys(): string[][] {
    this.sortKeys();
    return this.colKeys;
  }

  getRowKeys(): string[][] {
    this.sortKeys();
    return this.rowKeys;
  }

  processRecord(record: PivotRecord): void {
    // this code is called in a tight loop
    const colKey: string[] = [];
    const rowKey: string[] = [];
    (this.props.cols as string[]).forEach((col: string) => {
      colKey.push(col in record ? String(record[col]) : 'null');
    });
    (this.props.rows as string[]).forEach((row: string) => {
      rowKey.push(row in record ? String(record[row]) : 'null');
    });

    this.allTotal.push(record);

    const rowStart = this.subtotals.rowEnabled ? 1 : Math.max(1, rowKey.length);
    const colStart = this.subtotals.colEnabled ? 1 : Math.max(1, colKey.length);

    let isRowSubtotal;
    let isColSubtotal;
    for (let ri = rowStart; ri <= rowKey.length; ri += 1) {
      isRowSubtotal = ri < rowKey.length;
      const fRowKey = rowKey.slice(0, ri);
      const flatRowKey = flatKey(fRowKey);
      if (!this.rowTotals[flatRowKey]) {
        this.rowKeys.push(fRowKey);
        this.rowTotals[flatRowKey] = this.getFormattedAggregator(
          record,
          rowKey,
        )(this, fRowKey, []);
      }
      this.rowTotals[flatRowKey].push(record);
      this.rowTotals[flatRowKey].isSubtotal = isRowSubtotal;
    }

    for (let ci = colStart; ci <= colKey.length; ci += 1) {
      isColSubtotal = ci < colKey.length;
      const fColKey = colKey.slice(0, ci);
      const flatColKey = flatKey(fColKey);
      if (!this.colTotals[flatColKey]) {
        this.colKeys.push(fColKey);
        this.colTotals[flatColKey] = this.getFormattedAggregator(
          record,
          colKey,
        )(this, [], fColKey);
      }
      this.colTotals[flatColKey].push(record);
      this.colTotals[flatColKey].isSubtotal = isColSubtotal;
    }

    // And now fill in for all the sub-cells.
    for (let ri = rowStart; ri <= rowKey.length; ri += 1) {
      isRowSubtotal = ri < rowKey.length;
      const fRowKey = rowKey.slice(0, ri);
      const flatRowKey = flatKey(fRowKey);
      if (!this.tree[flatRowKey]) {
        this.tree[flatRowKey] = {};
      }
      for (let ci = colStart; ci <= colKey.length; ci += 1) {
        isColSubtotal = ci < colKey.length;
        const fColKey = colKey.slice(0, ci);
        const flatColKey = flatKey(fColKey);
        if (!this.tree[flatRowKey][flatColKey]) {
          this.tree[flatRowKey][flatColKey] = this.getFormattedAggregator(
            record,
          )(this, fRowKey, fColKey);
        }
        this.tree[flatRowKey][flatColKey].push(record);

        this.tree[flatRowKey][flatColKey].isRowSubtotal = isRowSubtotal;
        this.tree[flatRowKey][flatColKey].isColSubtotal = isColSubtotal;
        this.tree[flatRowKey][flatColKey].isSubtotal =
          isRowSubtotal || isColSubtotal;
      }
    }
  }

  getAggregator(rowKey: string[], colKey: string[]): Aggregator {
    let agg;
    const flatRowKey = flatKey(rowKey);
    const flatColKey = flatKey(colKey);
    if (rowKey.length === 0 && colKey.length === 0) {
      agg = this.allTotal;
    } else if (rowKey.length === 0) {
      agg = this.colTotals[flatColKey];
    } else if (colKey.length === 0) {
      agg = this.rowTotals[flatRowKey];
    } else {
      agg = this.tree[flatRowKey][flatColKey];
    }
    return (
      agg || {
        value() {
          return null;
        },
        format() {
          return '';
        },
      }
    );
  }
}

// can handle arrays or jQuery selections of tables
PivotData.forEachRecord = function (
  input: unknown,
  processRecord: (record: PivotRecord) => void,
) {
  if (Array.isArray(input)) {
    // array of objects
    return input.map(record => processRecord(record));
  }
  throw new Error(t('Unknown input format'));
};

PivotData.defaultProps = {
  aggregators,
  cols: [],
  rows: [],
  vals: [],
  aggregatorName: 'Count',
  sorters: {},
  rowOrder: 'key_a_to_z',
  colOrder: 'key_a_to_z',
};

PivotData.propTypes = {
  data: PropTypes.oneOfType([PropTypes.array, PropTypes.object, PropTypes.func])
    .isRequired,
  aggregatorName: PropTypes.string,
  cols: PropTypes.arrayOf(PropTypes.string),
  rows: PropTypes.arrayOf(PropTypes.string),
  vals: PropTypes.arrayOf(PropTypes.string),
  valueFilter: PropTypes.objectOf(PropTypes.objectOf(PropTypes.bool)),
  sorters: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.objectOf(PropTypes.func),
  ]),
  derivedAttributes: PropTypes.objectOf(PropTypes.func),
  rowOrder: PropTypes.oneOf([
    'key_a_to_z',
    'key_z_to_a',
    'value_a_to_z',
    'value_z_to_a',
  ]),
  colOrder: PropTypes.oneOf([
    'key_a_to_z',
    'key_z_to_a',
    'value_a_to_z',
    'value_z_to_a',
  ]),
};

export type {
  SortFunction,
  Formatter,
  PivotRecord,
  Aggregator,
  SubtotalOptions,
};

export {
  aggregatorTemplates,
  aggregators,
  derivers,
  locales,
  naturalSort,
  numberFormat,
  getSort,
  sortAs,
  flatKey,
  PivotData,
};

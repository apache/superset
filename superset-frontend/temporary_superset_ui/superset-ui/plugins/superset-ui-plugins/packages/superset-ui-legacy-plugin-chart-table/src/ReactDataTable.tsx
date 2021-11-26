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
import { t } from '@superset-ui/translation';
import React, { useEffect, createRef } from 'react';
import { formatNumber, NumberFormats } from '@superset-ui/number-format';
import { getTimeFormatter } from '@superset-ui/time-format';
import { filterXSS } from 'xss';

// initialize datatables.net
import $ from 'jquery';
import dt from 'datatables.net-bs/js/dataTables.bootstrap';
import 'datatables.net-bs/css/dataTables.bootstrap.css';
import './Table.css';

import { DataTableProps } from './transformProps';

// Depending on how the modules are imported, `dt` may be a CommonJS init function,
// or the DataTable class itself. In case it is the former, we'd need to tell it
// where is jQuery.
if (!dt.$) {
  dt(window, $);
}

const { PERCENT_3_POINT } = NumberFormats;
const isProbablyHTML = (text: string) => /<[^>]+>/.test(text);

export default function ReactDataTable(props: DataTableProps) {
  const {
    data,
    height,
    alignPositiveNegative = false,
    colorPositiveNegative = false,
    columns,
    includeSearch = false,
    metrics: aggMetrics,
    pageLength,
    percentMetrics,
    tableTimestampFormat,
    // orderDesc,
    // TODO: add back the broken dashboard filters feature
    // filters = {},
    // onAddFilter = NOOP,
    // onRemoveFilter = NOOP,
    // tableFilter,
    // timeseriesLimitMetric,
  } = props;

  const formatTimestamp = getTimeFormatter(tableTimestampFormat);
  const metrics = (aggMetrics || [])
    .concat(percentMetrics || [])
    // actual records must be of numeric types as well
    .filter(m => typeof data[0][m] === 'number');

  // check whethere a key is a metric
  const metricsSet = new Set(aggMetrics);
  const percentMetricsSet = new Set(percentMetrics);

  // collect min/max for rendering bars
  const maxes: { [key: string]: number } = {};
  const mins: { [key: string]: number } = {};
  columns.forEach(({ key }) => {
    const vals = data.map(row => row[key]);
    if (metrics.includes(key)) {
      const nums = vals as number[];
      if (alignPositiveNegative) {
        maxes[key] = Math.max(...nums.map(Math.abs));
      } else {
        maxes[key] = Math.max(...nums);
        mins[key] = Math.min(...nums);
      }
    }
  });

  const viewportHeight = Math.min(height, window.innerHeight);
  const pageLengthChoices = [10, 25, 40, 50, 75, 100, 150, 200];
  const hasPagination = pageLength > 0;

  const rootElem = createRef<HTMLDivElement>();

  /**
   * Adjust styles after rendering the table
   */
  function drawCallback(this: DataTables.JQueryDataTables) {
    const root = rootElem.current as HTMLElement;
    // force smaller pagination, because datatables-bs hard-corded pagination styles
    $('.pagination', root).addClass('pagination-sm');
    // display tr rows on current page
    $('tr', root).css('display', '');
  }

  /**
   * Format text for cell value
   */
  function cellText(key: string, format: string | undefined, val: unknown) {
    if (key === '__timestamp') {
      return formatTimestamp(val);
    }
    if (typeof val === 'string') {
      return filterXSS(val, { stripIgnoreTag: true });
    }
    if (percentMetricsSet.has(key)) {
      // in case percent metric can specify percent format in the future
      return formatNumber(format || PERCENT_3_POINT, val as number);
    }
    if (metricsSet.has(key)) {
      // default format '' will return human readable numbers (e.g. 50M, 33k)
      return formatNumber(format, val as number);
    }
    return val;
  }

  /**
   * Cell background to render columns as horizontal bar chart
   */
  function cellBar(key: string, val: number) {
    const r = colorPositiveNegative && val < 0 ? 150 : 0;
    if (alignPositiveNegative) {
      const perc = Math.abs(Math.round((val / maxes[key]) * 100));
      // The 0.01 to 0.001 is a workaround for what appears to be a
      // CSS rendering bug on flat, transparent colors
      return (
        `linear-gradient(to right, rgba(${r},0,0,0.2), rgba(${r},0,0,0.2) ${perc}%, ` +
        `rgba(0,0,0,0.01) ${perc}%, rgba(0,0,0,0.001) 100%)`
      );
    }
    const posExtent = Math.abs(Math.max(maxes[key], 0));
    const negExtent = Math.abs(Math.min(mins[key], 0));
    const tot = posExtent + negExtent;
    const perc1 = Math.round((Math.min(negExtent + val, negExtent) / tot) * 100);
    const perc2 = Math.round((Math.abs(val) / tot) * 100);
    // The 0.01 to 0.001 is a workaround for what appears to be a
    // CSS rendering bug on flat, transparent colors
    return (
      `linear-gradient(to right, rgba(0,0,0,0.01), rgba(0,0,0,0.001) ${perc1}%, ` +
      `rgba(${r},0,0,0.2) ${perc1}%, rgba(${r},0,0,0.2) ${perc1 + perc2}%, ` +
      `rgba(0,0,0,0.01) ${perc1 + perc2}%, rgba(0,0,0,0.001) 100%)`
    );
  }

  const options = {
    aaSorting: [], // initial sorting order, reset to [] to use backend ordering
    autoWidth: false,
    paging: hasPagination,
    pagingType: 'first_last_numbers',
    pageLength,
    lengthMenu: [
      [...pageLengthChoices, -1],
      [...pageLengthChoices, t('All')],
    ],
    searching: includeSearch,
    language: {
      paginate: {
        first: t('First'),
        last: t('Last'),
        previous: t('Previous'),
        next: t('Next'),
      },
    },
    bInfo: false,
    scrollY: `${viewportHeight}px`,
    scrollCollapse: true,
    scrollX: true,
    drawCallback,
  };

  useEffect(() => {
    const $root = $(rootElem.current as HTMLElement);
    const dataTable = $root.find('table').DataTable(options);

    // adjust table height
    const scrollHeadHeight = 34;
    const paginationHeight = hasPagination ? 35 : 0;
    const searchBarHeight = hasPagination || includeSearch ? 35 : 0;
    const scrollBodyHeight = viewportHeight - scrollHeadHeight - paginationHeight - searchBarHeight;
    $root.find('.dataTables_scrollBody').css('max-height', scrollBodyHeight);

    return () => {
      // there may be weird lifecycle issues, so put destroy in try/catch
      try {
        dataTable.destroy();
        // reset height
        $root.find('.dataTables_scrollBody').css('max-height', '');
      } catch (error) {
        // pass
      }
    };
  });

  return (
    <div ref={rootElem} className="superset-legacy-chart-table">
      <table className="table table-striped table-condensed table-hover">
        <thead>
          <tr>
            {columns.map(col => (
              // by default all columns will have sorting
              <th key={col.key} className="sorting" title={col.label}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((record, i) => (
            // hide rows after first page makes the initial render faster (less layout computation)
            // eslint-disable-next-line react/no-array-index-key
            <tr key={i} style={{ display: pageLength > 0 && i >= pageLength ? 'none' : undefined }}>
              {columns.map(({ key, format }) => {
                const val = record[key];
                const keyIsMetric = metricsSet.has(key);
                const text = cellText(key, format, val);
                const isHtml = !keyIsMetric && isProbablyHTML(text);
                return (
                  <td
                    key={key}
                    // only set innerHTML for actual html content, this saves time
                    dangerouslySetInnerHTML={isHtml ? { __html: text } : undefined}
                    data-sort={val}
                    className={keyIsMetric ? 'text-right' : ''}
                    style={{
                      backgroundImage: keyIsMetric ? cellBar(key, val as number) : undefined,
                    }}
                    title={keyIsMetric || percentMetricsSet.has(key) ? (val as string) : ''}
                  >
                    {isHtml ? null : text}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

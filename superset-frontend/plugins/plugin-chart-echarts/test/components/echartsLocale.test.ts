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
import { init, use, registerLocale } from 'echarts/core';
import { LineChart } from 'echarts/charts';
import { SVGRenderer } from 'echarts/renderers';
import { GridComponent } from 'echarts/components';
import { LOCALE_LOADERS, loadLocale } from '../../src/components/echartsLocale';

type LocaleWithTime = {
  time?: { month?: string[]; dayOfWeek?: string[] };
};

test('loadLocale returns undefined for locales echarts does not ship', async () => {
  expect(await loadLocale('XX')).toBeUndefined();
});

test.each(Object.keys(LOCALE_LOADERS))(
  'locale %s loads a locale object with time names',
  async localeKey => {
    const localeObj = (await loadLocale(localeKey)) as LocaleWithTime;
    // A locale object without content would clobber echarts' builtin
    // locales when registered; missing `time` names crash every
    // time-axis chart inside echarts' time formatter (see #42314
    // discussion — "Cannot read properties of null (reading '0')").
    expect(localeObj).toBeDefined();
    expect(localeObj.time?.month).toHaveLength(12);
    expect(localeObj.time?.dayOfWeek).toHaveLength(7);
  },
);

test('registering the loaded EN locale keeps time-axis charts rendering', async () => {
  use([SVGRenderer, LineChart, GridComponent]);
  const localeObj = await loadLocale('EN');
  expect(localeObj).toBeDefined();
  registerLocale('EN', localeObj!);

  const chart = init(null, null, {
    renderer: 'svg',
    ssr: true,
    width: 400,
    height: 300,
    locale: 'EN',
  });
  chart.setOption(
    {
      xAxis: { type: 'time' },
      yAxis: { type: 'value' },
      series: [
        {
          type: 'line',
          data: [
            [new Date(1965, 0, 1).getTime(), 100],
            [new Date(1985, 0, 1).getTime(), 200],
            [new Date(2005, 0, 1).getTime(), 150],
          ],
        },
      ],
    },
    { notMerge: true, lazyUpdate: false },
  );
  expect(chart.renderToSVGString()).toContain('<svg');
});

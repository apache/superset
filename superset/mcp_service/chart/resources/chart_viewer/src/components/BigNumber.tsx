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
import type { JSX } from 'react';
import type { ChartData } from '../types';
import type { ThemeTokens } from '../theme';
import { buildSparklineOption, resolveBigNumber } from '../adapter';
import { formatFull, formatNumber } from '../format';
import { EChart } from './EChart';

/** Large KPI value with an optional trend sparkline. */
export function BigNumber({
  data,
  theme,
}: {
  data: ChartData;
  theme: ThemeTokens;
}): JSX.Element {
  const { value, label, spark } = resolveBigNumber(data);
  const display = formatNumber(value);
  const full = formatFull(value);
  return (
    <div className="sv-bignum">
      <div className="sv-bignum-label">{label}</div>
      <div className="sv-bignum-value">{display}</div>
      {full !== display && <div className="sv-bignum-full">{full}</div>}
      {spark && (
        <div className="sv-bignum-spark">
          <EChart option={buildSparklineOption(spark, theme)} scheme={theme.scheme} />
        </div>
      )}
    </div>
  );
}

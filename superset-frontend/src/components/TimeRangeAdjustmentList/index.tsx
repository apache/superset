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
import { t } from '@apache-superset/core/translation';
import type { TimeRangeAdjustment } from './types';

const ruleLabel = (field: string) =>
  ({
    max_span: t('Maximum span'),
    max_look_back: t('Maximum look-back'),
    max_look_forward: t('Maximum look-forward'),
  })[field] ?? field;

const describe = (adjustment: TimeRangeAdjustment) => {
  if (adjustment.kind === 'time_range_limit') {
    return t(
      'Time range limit "%s": "%s" → "%s"',
      ruleLabel(adjustment.field),
      adjustment.old_label,
      adjustment.new_label,
    );
  }
  if (adjustment.field === 'applied_range') {
    return t(
      'Time range filter "%s": applied range "%s" → "%s"',
      adjustment.name,
      adjustment.old_label,
      adjustment.new_label,
    );
  }
  return t(
    'Time range filter "%s": default "%s" → "%s"',
    adjustment.name,
    adjustment.old_label,
    adjustment.new_label,
  );
};

const dashboardKey = (adjustment: TimeRangeAdjustment) =>
  `${adjustment.file ?? ''}|${adjustment.dashboard_key || adjustment.dashboard}`;

const itemKey = (adjustment: TimeRangeAdjustment) =>
  [
    dashboardKey(adjustment),
    adjustment.kind,
    adjustment.filter_id ?? '',
    adjustment.field,
  ].join('|');

const dashboardHeading = ({ dashboard, file }: TimeRangeAdjustment) => {
  const title = dashboard || t('Untitled dashboard');
  return file
    ? t('Dashboard "%s" (%s)', title, file)
    : t('Dashboard "%s"', title);
};

const AdjustmentItems = ({
  adjustments,
}: {
  adjustments: TimeRangeAdjustment[];
}) => (
  <ul>
    {adjustments.map(adjustment => (
      <li key={itemKey(adjustment)}>{describe(adjustment)}</li>
    ))}
  </ul>
);

/**
 * The changes in plain words, grouped by dashboard. Each group is headed by its
 * dashboard when ``showDashboard`` is set or the changes touch several.
 */
export const TimeRangeAdjustmentList = ({
  adjustments,
  showDashboard = false,
}: {
  adjustments: TimeRangeAdjustment[];
  showDashboard?: boolean;
}) => {
  const groups = new Map<string, TimeRangeAdjustment[]>();
  adjustments.forEach(adjustment => {
    const key = dashboardKey(adjustment);
    groups.set(key, [...(groups.get(key) ?? []), adjustment]);
  });
  if (groups.size < 2 && !showDashboard) {
    return <AdjustmentItems adjustments={adjustments} />;
  }
  return (
    <>
      {[...groups].map(([key, items]) => (
        <div key={key}>
          <div>{dashboardHeading(items[0])}</div>
          <AdjustmentItems adjustments={items} />
        </div>
      ))}
    </>
  );
};

export type { TimeRangeAdjustment };

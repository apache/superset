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

/**
 * A popover editor for one ad-hoc metric — Dashboard V2's own, not the
 * classic Explore control panel's `AdhocMetricEditPopover`. That component
 * is a fine model for the *shape* of an ad-hoc metric, but not for reuse
 * verbatim here: it reads `state.explore.compatibleMetrics` via
 * `useSelector`, which throws outside a react-redux `Provider`, and Dashboard
 * V2 is deliberately non-Redux; its own "Saved" tab is also redundant with
 * the picker `MetricMultiControl` already offers for saved metrics, so only
 * the Simple and Custom SQL tabs represent capability worth reusing.
 *
 * What *is* reused: the legacy `AdhocMetric` class (`MetricControl/AdhocMetric.ts`)
 * as the editing/validation model — the same `expressionType`/`column`/
 * `aggregate`/`sqlExpression`/`label` shape the backend and the classic
 * control panel both already agree on, so nothing about "what an ad-hoc
 * metric is" is redefined here — plus `AGGREGATES_OPTIONS` and
 * `SQLEditorWithValidation`, both already free of Explore-specific coupling.
 */
import { useEffect, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { t } from '@apache-superset/core/translation';
import { useTheme } from '@apache-superset/core/theme';
import type { AdhocMetric as CoreAdhocMetric } from '@superset-ui/core';
import {
  Button,
  Form,
  Popover,
  Select,
  Tabs,
} from '@superset-ui/core/components';
import LegacyAdhocMetric, {
  EXPRESSION_TYPES,
  fromCoreAdhocMetric,
} from 'src/explore/components/controls/MetricControl/AdhocMetric';
import { AGGREGATES_OPTIONS } from 'src/explore/constants';
import SQLEditorWithValidation from 'src/components/SQLEditorWithValidation';
import type { DatasetColumnMeta } from 'src/core/dashboard/datasetMetadata';

const BLANK_METRIC = { expressionType: EXPRESSION_TYPES.SIMPLE };

/** The plain, storable shape `handleChange` writes back into `node.props` —
 * only the fields `@superset-ui/core`'s `AdhocMetric` type declares, not the
 * legacy class's extra runtime-only fields (`datasourceWarning` and the
 * like). */
function toPlainMetric(draft: LegacyAdhocMetric): CoreAdhocMetric {
  const base = {
    label: draft.label,
    hasCustomLabel: draft.hasCustomLabel,
    optionName: draft.optionName,
  };
  if (draft.expressionType === EXPRESSION_TYPES.SQL) {
    return {
      ...base,
      expressionType: 'SQL',
      sqlExpression: draft.sqlExpression ?? '',
    } as CoreAdhocMetric;
  }
  return {
    ...base,
    expressionType: 'SIMPLE',
    column: draft.column!,
    aggregate: draft.aggregate,
  } as CoreAdhocMetric;
}

export interface AdhocMetricEditorProps {
  /** `undefined` opens the editor on a blank draft (adding a new metric). */
  value: CoreAdhocMetric | undefined;
  columns: DatasetColumnMeta[];
  datasourceId: number | undefined;
  datasourceType: string | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (metric: CoreAdhocMetric) => void;
  children: ReactNode;
}

/**
 * Wraps `children` (the row's own clickable label) in a click-triggered
 * popover editing one ad-hoc metric. Nothing commits until Save — Cancel, an
 * outside click, or Escape all discard the draft, matching every other
 * validated-commit surface in this panel where a candidate is built and
 * discarded freely before it's actually written.
 */
export default function AdhocMetricEditor({
  value,
  columns,
  datasourceId,
  datasourceType,
  open,
  onOpenChange,
  onSave,
  children,
}: AdhocMetricEditorProps): ReactElement {
  const theme = useTheme();
  const [draft, setDraft] = useState<LegacyAdhocMetric>(() =>
    value ? fromCoreAdhocMetric(value) : new LegacyAdhocMetric(BLANK_METRIC),
  );

  // Re-seed the draft from `value` every time the popover opens, so a
  // cancelled edit never leaks into the next one.
  useEffect(() => {
    if (open) {
      setDraft(
        value
          ? fromCoreAdhocMetric(value)
          : new LegacyAdhocMetric(BLANK_METRIC),
      );
    }
  }, [open, value]);

  const columnOptions = columns.map(column => ({
    value: column.name,
    label: column.verboseName,
  }));

  const content = (
    <div
      style={{
        width: theme.sizeUnit * 80,
        padding: `${theme.sizeUnit}px ${theme.sizeUnit * 3}px ${theme.sizeUnit * 3}px`,
      }}
      data-test="adhoc-metric-editor"
    >
      <Tabs
        size="small"
        activeKey={draft.expressionType}
        onChange={key => setDraft(draft.duplicateWith({ expressionType: key }))}
        items={[
          {
            key: EXPRESSION_TYPES.SIMPLE,
            label: t('Simple'),
            children: (
              <Form
                layout="vertical"
                component="div"
                style={{ paddingTop: theme.sizeUnit * 3 }}
              >
                <Form.Item
                  label={t('Column')}
                  style={{ marginBottom: theme.sizeUnit * 4 }}
                >
                  <Select
                    ariaLabel={t('Column')}
                    value={draft.column?.column_name}
                    options={columnOptions}
                    onChange={next => {
                      const picked = columns.find(
                        column => column.name === next,
                      );
                      setDraft(
                        draft.duplicateWith({
                          column: picked
                            ? {
                                column_name: picked.name,
                                verbose_name: picked.verboseName,
                              }
                            : null,
                        }),
                      );
                    }}
                  />
                </Form.Item>
                <Form.Item label={t('Aggregate')} style={{ marginBottom: 0 }}>
                  <Select
                    ariaLabel={t('Aggregate')}
                    value={draft.aggregate ?? undefined}
                    options={AGGREGATES_OPTIONS.map(aggregate => ({
                      value: aggregate,
                      label: aggregate,
                    }))}
                    onChange={next =>
                      setDraft(
                        draft.duplicateWith({ aggregate: next as string }),
                      )
                    }
                  />
                </Form.Item>
              </Form>
            ),
          },
          {
            key: EXPRESSION_TYPES.SQL,
            label: t('Custom SQL'),
            children: (
              <div style={{ paddingTop: theme.sizeUnit * 3 }}>
                <SQLEditorWithValidation
                  value={draft.sqlExpression ?? ''}
                  onChange={next =>
                    setDraft(draft.duplicateWith({ sqlExpression: next }))
                  }
                  showValidation
                  expressionType="metric"
                  datasourceId={datasourceId}
                  datasourceType={datasourceType}
                  height="120px"
                />
              </div>
            ),
          },
        ]}
      />
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: theme.sizeUnit * 2,
          marginTop: theme.sizeUnit * 4,
        }}
      >
        <Button
          buttonSize="xsmall"
          buttonStyle="secondary"
          onClick={() => onOpenChange(false)}
        >
          {t('Cancel')}
        </Button>
        <Button
          buttonSize="xsmall"
          buttonStyle="primary"
          disabled={!draft.isValid()}
          data-test="adhoc-metric-editor-save"
          onClick={() => {
            onSave(toPlainMetric(draft));
            onOpenChange(false);
          }}
        >
          {t('Save')}
        </Button>
      </div>
    </div>
  );

  return (
    <Popover
      trigger="click"
      open={open}
      onOpenChange={onOpenChange}
      content={content}
      placement="bottom"
    >
      {children}
    </Popover>
  );
}

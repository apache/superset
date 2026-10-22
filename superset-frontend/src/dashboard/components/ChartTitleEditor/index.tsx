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
import { KeyboardEvent, useId, useState } from 'react';
import { t } from '@apache-superset/core/translation';
import {
  Checkbox,
  Form,
  Input,
  Modal,
  Select,
  Typography,
} from '@superset-ui/core/components';
import type { DynamicTitleConfig } from 'src/dashboard/types';
import {
  CHART_TITLE_ALIAS,
  createDynamicTitleAlias,
  extractDynamicTitleAliases,
  getChartBaseTitle,
  getInvalidDynamicTitleAliases,
  hasInvalidDynamicTitleTokens,
} from 'src/dashboard/util/dynamicTitle';
import { useDynamicChartTitle } from 'src/dashboard/util/useDynamicChartTitle';

interface ChartTitleEditorProps {
  chartId: number;
  baseTitle: string;
  originalTitle: string;
  config?: DynamicTitleConfig;
  onApply: (baseTitle: string, config?: DynamicTitleConfig) => void;
  onHide: () => void;
}

export default function ChartTitleEditor({
  chartId,
  baseTitle,
  originalTitle,
  config,
  onApply,
  onHide,
}: ChartTitleEditorProps) {
  const id = useId();
  const [title, setTitle] = useState(baseTitle);
  const [enabled, setEnabled] = useState(Boolean(config));
  const [template, setTemplate] = useState(
    typeof config?.template === 'string' ? config.template : '',
  );
  const [tokenMappings, setTokenMappings] = useState(
    config?.tokenMappings && typeof config.tokenMappings === 'object'
      ? config.tokenMappings
      : {},
  );
  const [submitted, setSubmitted] = useState(false);
  const draft = { template, tokenMappings };
  const { filters, title: preview } = useDynamicChartTitle(
    chartId,
    getChartBaseTitle(title, originalTitle),
    enabled ? draft : undefined,
  );
  const invalidAliases = getInvalidDynamicTitleAliases(draft, filters);
  const error = !template.trim()
    ? t('Enter a title template.')
    : hasInvalidDynamicTitleTokens(template)
      ? t('Use tokens in the format {{filter_name}}.')
      : invalidAliases.length
        ? t('Update or remove invalid tokens: %s', invalidAliases.join(', '))
        : undefined;

  const insertToken = (value: string) => {
    let alias = CHART_TITLE_ALIAS;
    if (value !== CHART_TITLE_ALIAS) {
      const filter = filters.find(item => item.id === value);
      if (!filter) {
        return;
      }
      alias =
        Object.entries(tokenMappings).find(
          ([key, filterId]) =>
            filterId === value &&
            /^[a-zA-Z0-9_]+$/.test(key) &&
            key !== CHART_TITLE_ALIAS,
        )?.[0] ??
        createDynamicTitleAlias(filter.name, Object.keys(tokenMappings));
      setTokenMappings(previous => ({ ...previous, [alias]: value }));
    }
    setTemplate(
      previous =>
        `${previous}${previous && !/\s$/.test(previous) ? ' ' : ''}{{${alias}}}`,
    );
  };

  const apply = () => {
    setSubmitted(true);
    if (enabled && error) {
      return;
    }
    const aliases = extractDynamicTitleAliases(template);
    onApply(
      title,
      enabled
        ? {
            template: template.trim(),
            tokenMappings: Object.fromEntries(
              Object.entries(tokenMappings).filter(
                ([alias]) =>
                  alias !== CHART_TITLE_ALIAS && aliases.includes(alias),
              ),
            ),
          }
        : undefined,
    );
  };

  return (
    <Modal
      show
      onHide={onHide}
      name={t('Configure chart title')}
      title={t('Configure chart title')}
      primaryButtonName={t('Apply')}
      onHandledPrimaryAction={apply}
      responsive
      width={640}
      wrapProps={{
        onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => {
          if (
            (event.ctrlKey || event.metaKey) &&
            (['z', 'y'].includes(event.key.toLowerCase()) ||
              ['KeyZ', 'KeyY'].includes(event.code))
          ) {
            // Keep draft undo/redo away from layout history, including footer controls.
            event.stopPropagation();
          }
        },
      }}
    >
      <Form layout="vertical">
        <Form.Item label={t('Base title')} htmlFor={`${id}-base`}>
          <Input
            id={`${id}-base`}
            value={title}
            onChange={event => setTitle(event.target.value)}
          />
        </Form.Item>
        <Form.Item>
          <Checkbox
            checked={enabled}
            onChange={event => setEnabled(event.target.checked)}
          >
            {t('Use a dynamic title')}
          </Checkbox>
        </Form.Item>
        {enabled && (
          <>
            <Form.Item label={t('Insert token')}>
              <Select
                ariaLabel={t('Insert token')}
                value={undefined}
                placeholder={t('Choose a filter or the base title')}
                options={[
                  { value: CHART_TITLE_ALIAS, label: t('Base chart title') },
                  ...filters.map(filter => ({
                    value: filter.id,
                    label: filter.name,
                  })),
                ]}
                onSelect={value => insertToken(String(value))}
              />
            </Form.Item>
            {!filters.length && (
              <Typography.Paragraph type="secondary">
                {t('No native filters affect this chart.')}
              </Typography.Paragraph>
            )}
            <Form.Item
              label={t('Title template')}
              htmlFor={`${id}-template`}
              validateStatus={
                (submitted || config) && error ? 'error' : undefined
              }
              help={(submitted || config) && error ? error : undefined}
            >
              <Input.TextArea
                id={`${id}-template`}
                value={template}
                rows={3}
                onChange={event => setTemplate(event.target.value)}
                placeholder={t('Example: {{chart_title}} - {{country}}')}
              />
            </Form.Item>
          </>
        )}
        <Typography.Paragraph strong>{t('Preview')}</Typography.Paragraph>
        <Typography.Paragraph
          aria-live="polite"
          data-test="dynamic-title-preview"
        >
          {preview || t('[ untitled chart ]')}
        </Typography.Paragraph>
        <Typography.Paragraph type="secondary">
          {t(
            'The base title is shown when a referenced filter has no value or no longer affects this chart.',
          )}
        </Typography.Paragraph>
        <Typography.Paragraph type="secondary">
          {t('Save the dashboard to persist these changes.')}
        </Typography.Paragraph>
      </Form>
    </Modal>
  );
}

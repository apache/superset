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
import { useEffect, useState } from 'react';
import {
  SupersetClient,
  buildQueryContext,
  normalizeOrderBy,
  JsonObject,
} from '@superset-ui/core';
import { SafeMarkdown } from '@superset-ui/core/components';
import { styled } from '@apache-superset/core/theme';
import { t } from '@apache-superset/core/translation';
import Handlebars from 'handlebars';
import { HELPER_IMPLEMENTATIONS } from './helpers';
import { SlotConfig, SlotResult } from './types';

type Props = {
  /** Dashboard ID, used to fetch config from the dedicated config table. */
  dashboardId?: number;
};

async function extractErrorMessage(error: unknown): Promise<string> {
  if (error instanceof Error) return error.message;
  const response = error as Partial<Response>;
  if (response && typeof response.json === 'function') {
    try {
      const body = await (response as Response).clone().json();
      return (
        body?.errors?.[0]?.message ?? body?.message ?? JSON.stringify(body)
      );
    } catch {
      try {
        return await (response as Response).clone().text();
      } catch {
        return String(error);
      }
    }
  }
  return String(error);
}

async function fetchSlot(slot: SlotConfig): Promise<SlotResult> {
  const payload = buildQueryContext(slot.formData, baseQueryObject => [
    {
      ...baseQueryObject,
      orderby: normalizeOrderBy(baseQueryObject).orderby,
    },
  ]);

  try {
    const { json } = await SupersetClient.post({
      endpoint: '/api/v1/chart/data',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const result = (json as JsonObject).result?.[0] ?? {};
    return {
      data: result.data ?? [],
      columns: result.colnames ?? [],
    };
  } catch (e) {
    throw new Error(`Slot "${slot.name}": ${await extractErrorMessage(e)}`);
  }
}

interface DynamicDashboardApiConfig {
  dashboard_template: string;
  slots: SlotConfig[];
}

const ErrorPre = styled.pre`
  white-space: pre-wrap;
`;

const HandlebarsDashboard = ({ dashboardId }: Props) => {
  const [apiConfig, setApiConfig] = useState<DynamicDashboardApiConfig | null>(
    null,
  );
  const [configError, setConfigError] = useState<string | null>(null);
  const [context, setContext] = useState<Record<string, SlotResult> | null>(
    null,
  );
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Fetch the template + slots from the dedicated config table.
  useEffect(() => {
    if (!dashboardId) {
      setConfigError('No dashboard ID available');
      return;
    }

    let cancelled = false;

    SupersetClient.get({
      endpoint: `/api/v1/dynamic-dashboard/${dashboardId}/config`,
    })
      .then(({ json }) => {
        if (cancelled) return;
        const result = json as JsonObject;
        if (result.error) {
          setConfigError(result.error as string);
        } else {
          setApiConfig({
            dashboard_template: result.dashboard_template as string,
            slots: (result.slots as SlotConfig[]) ?? [],
          });
        }
      })
      .catch(async e => {
        if (cancelled) return;
        setConfigError(await extractErrorMessage(e));
      });

    return () => {
      cancelled = true;
    };
  }, [dashboardId]);

  // Fetch slot data once config is loaded.
  useEffect(() => {
    if (!apiConfig) return;
    let cancelled = false;

    const slots = apiConfig.slots;

    Promise.allSettled(slots.map(fetchSlot)).then(results => {
      if (cancelled) return;
      const ctx: Record<string, SlotResult> = {};
      const errors: string[] = [];
      slots.forEach((slot, i) => {
        const outcome = results[i];
        if (outcome.status === 'fulfilled') {
          ctx[slot.name] = outcome.value;
        } else {
          ctx[slot.name] = { data: [], columns: [] };
          errors.push(
            outcome.reason instanceof Error
              ? outcome.reason.message
              : String(outcome.reason),
          );
        }
      });
      if (errors.length > 0 && errors.length === slots.length) {
        setFetchError(errors.join('\n'));
      } else {
        if (errors.length > 0) {
          // eslint-disable-next-line no-console
          console.error('Some Handlebars dashboard slots failed:', errors);
        }
        setContext(ctx);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [apiConfig]);

  const appContainer = document.getElementById('app');
  const { common } = JSON.parse(
    appContainer?.getAttribute('data-bootstrap') || '{}',
  );
  const htmlSanitization = common?.conf?.HTML_SANITIZATION ?? true;
  const htmlSchemaOverrides =
    common?.conf?.HTML_SANITIZATION_SCHEMA_EXTENSIONS || {};

  const [rendered, setRendered] = useState('');
  const [renderError, setRenderError] = useState('');

  useEffect(() => {
    if (!context || !apiConfig) return;
    const partials: Record<string, string> = Object.fromEntries(
      apiConfig.slots.map((slot: SlotConfig) => [slot.name, slot.template]),
    );
    const hb = Handlebars.create();
    try {
      Object.entries(HELPER_IMPLEMENTATIONS).forEach(([name, fn]) =>
        hb.registerHelper(name, fn),
      );
      Object.entries(partials).forEach(([name, src]) =>
        hb.registerPartial(name, src),
      );
      const template = hb.compile(apiConfig.dashboard_template);
      setRendered(template(context));
      setRenderError('');
    } catch (e) {
      setRendered('');
      setRenderError(e instanceof Error ? e.message : String(e));
    }
  }, [apiConfig, context]);

  if (configError) return <ErrorPre>{configError}</ErrorPre>;
  if (fetchError) return <ErrorPre>{fetchError}</ErrorPre>;
  if (renderError) return <ErrorPre>{renderError}</ErrorPre>;
  if (!apiConfig || !context) return <p>{t('Loading...')}</p>;

  return (
    <SafeMarkdown
      source={rendered}
      htmlSanitization={htmlSanitization}
      htmlSchemaOverrides={htmlSchemaOverrides}
    />
  );
};

export default HandlebarsDashboard;

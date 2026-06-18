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
import { styled } from '@apache-superset/core/theme';
import { SafeMarkdown } from '@superset-ui/core/components';
import { extendedDayjs as dayjs } from '@superset-ui/core/utils/dates';
import Handlebars from 'handlebars';
import { useMemo, useState } from 'react';
import { isPlainObject } from 'lodash';
import Helpers from 'just-handlebars-helpers';
import HandlebarsGroupBy from 'handlebars-group-by';

export interface HandlebarsViewerProps {
  templateSource: string;
  data: any;
}

export const HandlebarsViewer = ({
  templateSource,
  data,
}: HandlebarsViewerProps) => {
  const [renderedTemplate, setRenderedTemplate] = useState('');
  const [error, setError] = useState('');
  const appContainer = document.getElementById('app');
  const { common } = JSON.parse(
    appContainer?.getAttribute('data-bootstrap') || '{}',
  );
  const htmlSanitization = common?.conf?.HTML_SANITIZATION ?? true;
  const htmlSchemaOverrides =
    common?.conf?.HTML_SANITIZATION_SCHEMA_EXTENSIONS || {};

  useMemo(() => {
    try {
      const template = Handlebars.compile(templateSource);
      const result = template(data);
      setRenderedTemplate(result);
      setError('');
    } catch (error) {
      setRenderedTemplate('');
      setError(error.message);
    }
  }, [templateSource, data]);

  const Error = styled.pre`
    white-space: pre-wrap;
  `;

  if (error) {
    return <Error>{error}</Error>;
  }

  if (renderedTemplate) {
    return (
      <SafeMarkdown
        source={renderedTemplate}
        htmlSanitization={htmlSanitization}
        htmlSchemaOverrides={htmlSchemaOverrides}
      />
    );
  }
  return <p>{t('Loading...')}</p>;
};

//  usage: {{ dateFormat my_date format="MMMM YYYY" }}
Handlebars.registerHelper('dateFormat', function (context, block) {
  const f = block.hash.format || 'YYYY-MM-DD';
  return dayjs(context).format(f);
});

// usage: {{  }}
Handlebars.registerHelper('stringify', (obj: any, obj2: any) => {
  // calling without an argument
  if (obj2 === undefined)
    throw new Error('Please call with an object. Example: `stringify myObj`');
  return isPlainObject(obj) ? JSON.stringify(obj) : String(obj);
});

Handlebars.registerHelper(
  'formatNumber',
  function (number: any, locale = 'en-US') {
    if (typeof number !== 'number') {
      return number;
    }
    return number.toLocaleString(locale);
  },
);

// usage: {{parseJson jsonString}}
Handlebars.registerHelper('parseJson', (jsonString: string) => {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    if (error instanceof Error) {
      error.message = `Invalid JSON string: ${error.message}`;
      throw error;
    }
    throw new Error(`Invalid JSON string: ${String(error)}`);
  }
});

Helpers.registerHelpers(Handlebars);
HandlebarsGroupBy.register(Handlebars);

// `just-handlebars-helpers` registers a `formatDate` helper that lazily
// resolves `moment` via `global.moment` / `require('moment/min/moment-with-locales')`.
// The bundled viewer switched to dayjs and never satisfies that lookup, so the
// original helper throws "... is not a function" (see #32960). Re-register a
// dayjs-backed `formatDate` with the same `{{formatDate formatString date [locale]}}`
// signature so existing templates keep rendering.
Handlebars.registerHelper('formatDate', (formatString, date, localeString) => {
  const format = typeof formatString === 'string' ? formatString : '';
  const instance = dayjs(date ?? new Date());
  // Handlebars always passes its options object as the final argument, so a
  // locale is only present when the caller supplied an explicit string.
  // Note: `extendedDayjs` only loads the `en` locale, so passing a non-English
  // locale here quietly falls back to English unless that locale bundle has
  // been imported elsewhere; dayjs's instance `.locale()` is a no-op otherwise.
  return typeof localeString === 'string'
    ? instance.locale(localeString).format(format)
    : instance.format(format);
});

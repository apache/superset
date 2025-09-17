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
import { useEffect, useState, memo } from 'react';
import { styled, t } from '@superset-ui/core';
import { SafeMarkdown } from '@superset-ui/core/components';
import Handlebars from 'handlebars';
import dayjs from 'dayjs';
import { isPlainObject } from 'lodash';

export interface HandlebarsRendererProps {
  templateSource: string;
  data: any;
}

const ErrorContainer = styled.pre`
  white-space: pre-wrap;
  color: ${({ theme }) => theme.colorError};
  background-color: ${({ theme }) => theme.colorErrorBg};
  padding: ${({ theme }) => theme.sizeUnit * 2}px;
  border-radius: ${({ theme }) => theme.borderRadius}px;
`;

export const HandlebarsRenderer: React.FC<HandlebarsRendererProps> = memo(
  ({ templateSource, data }) => {
    const [renderedTemplate, setRenderedTemplate] = useState('');
    const [error, setError] = useState('');
    const appContainer = document.getElementById('app');
    const { common } = JSON.parse(
      appContainer?.getAttribute('data-bootstrap') || '{}',
    );
    const htmlSanitization = common?.conf?.HTML_SANITIZATION ?? true;
    const htmlSchemaOverrides =
      common?.conf?.HTML_SANITIZATION_SCHEMA_EXTENSIONS || {};

    useEffect(() => {
      try {
        const template = Handlebars.compile(templateSource);
        const result = template(data);
        setRenderedTemplate(result);
        setError('');
      } catch (error) {
        setRenderedTemplate('');
        setError(error.message || 'Unknown template error');
      }
    }, [templateSource, data]);

    if (error) {
      return <ErrorContainer>{error}</ErrorContainer>;
    }

    if (renderedTemplate || renderedTemplate === '') {
      return (
        <div
          style={{
            maxWidth: '300px',
            wordWrap: 'break-word',
            fontSize: '12px',
            lineHeight: '1.4',
          }}
        >
          <SafeMarkdown
            source={renderedTemplate || ''}
            htmlSanitization={htmlSanitization}
            htmlSchemaOverrides={htmlSchemaOverrides}
          />
        </div>
      );
    }

    return <p>{t('Loading...')}</p>;
  },
);

Handlebars.registerHelper('dateFormat', function (context, options) {
  const format = options.hash.format || 'YYYY-MM-DD HH:mm:ss';
  if (!context) return '';

  try {
    if (typeof context === 'number') {
      const timestamp = context > 1000000000000 ? context : context * 1000;
      return dayjs(timestamp).format(format);
    }
    return dayjs(context).format(format);
  } catch (e) {
    return String(context);
  }
});

Handlebars.registerHelper('formatNumber', function (number, options) {
  if (typeof number !== 'number') {
    return number;
  }

  const locale = options.hash.locale || 'en-US';
  const { minimumFractionDigits } = options.hash;
  const { maximumFractionDigits } = options.hash;

  const formatOptions: Intl.NumberFormatOptions = {};
  if (minimumFractionDigits !== undefined) {
    formatOptions.minimumFractionDigits = minimumFractionDigits;
  }
  if (maximumFractionDigits !== undefined) {
    formatOptions.maximumFractionDigits = maximumFractionDigits;
  }

  return number.toLocaleString(locale, formatOptions);
});

Handlebars.registerHelper('stringify', function (obj) {
  if (obj === undefined || obj === null) {
    return '';
  }

  if (isPlainObject(obj)) {
    try {
      return JSON.stringify(obj, null, 2);
    } catch (e) {
      return String(obj);
    }
  }

  return String(obj);
});

Handlebars.registerHelper(
  'ifExists',
  function (this: any, value: any, options: any) {
    if (value !== null && value !== undefined && value !== '') {
      return options.fn(this);
    }
    return options.inverse(this);
  },
);

Handlebars.registerHelper('default', function (value, fallback) {
  return value !== null && value !== undefined && value !== ''
    ? value
    : fallback;
});

Handlebars.registerHelper('truncate', function (text, length) {
  if (typeof text !== 'string') {
    return text;
  }

  if (text.length <= length) {
    return text;
  }

  return `${text.substring(0, length)}...`;
});

Handlebars.registerHelper('formatCoordinate', function (longitude, latitude) {
  if (
    longitude === null ||
    longitude === undefined ||
    latitude === null ||
    latitude === undefined
  ) {
    return '';
  }

  const lng = typeof longitude === 'number' ? longitude.toFixed(6) : longitude;
  const lat = typeof latitude === 'number' ? latitude.toFixed(6) : latitude;

  return `${lng}, ${lat}`;
});

Handlebars.registerHelper('first', function (array) {
  if (Array.isArray(array) && array.length > 0) {
    return array[0];
  }
  return null;
});

Handlebars.registerHelper('getField', function (array, fieldName) {
  if (!Array.isArray(array) || array.length === 0) {
    return '';
  }

  const values = array
    .map(item => item[fieldName])
    .filter(
      (value, index, self) =>
        value !== undefined && value !== null && self.indexOf(value) === index,
    );

  if (values.length === 0) return '';
  if (values.length === 1) return values[0];
  return values.slice(0, 3).join(', ') + (values.length > 3 ? '...' : '');
});

Handlebars.registerHelper('limit', function (value, limit) {
  if (!value) return '';

  // Handle arrays
  if (Array.isArray(value)) {
    const limitedArray = value.slice(0, limit);
    return limitedArray.join(', ') + (value.length > limit ? '...' : '');
  }

  // Handle strings (comma-separated values)
  if (typeof value === 'string') {
    const items = value.split(',').map(item => item.trim());
    if (items.length <= limit) return value;

    const limitedItems = items.slice(0, limit);
    return `${limitedItems.join(', ')}...`;
  }

  // For other types, return as-is
  return value;
});

export default HandlebarsRenderer;

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
 * Extra JSONForms renderers for schema-driven widget controls, on top
 * of the Semantic Layer's shared `renderers`:
 *   - `x-control: code`  → a raw JSON editor (e.g. AG Grid column definitions).
 *   - `x-control: color` → a native color swatch (e.g. per-series balloon color).
 *
 * Both fall back to the field's schema `default`, since JsonForms does not
 * write defaults into the data until a field is touched.
 */
import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { withJsonFormsControlProps } from '@jsonforms/react';
import type { ControlProps, JsonSchema } from '@jsonforms/core';
import { rankWith, schemaMatches } from '@jsonforms/core';
import { Flex, Typography } from '@superset-ui/core/components';
import { useTheme } from '@apache-superset/core/theme';
import { renderers as baseRenderers } from 'src/features/semanticLayers/jsonFormsHelpers';

const xControlIs = (value: string) =>
  schemaMatches(
    (schema: JsonSchema) =>
      (schema as Record<string, unknown>)['x-control'] === value,
  );

/** Raw JSON editor for an `x-control: code` field. */
function CodeControl({
  data,
  handleChange,
  path,
  schema,
  label,
}: ControlProps) {
  const schemaRecord = schema as Record<string, unknown>;
  // Fall back to the schema default, or an empty container of the right kind
  // (`[]` for an array field like `metrics`, `{}` otherwise) so the editor
  // opens on a valid, type-appropriate value rather than `{}` for an array.
  const fallback =
    schemaRecord.default ?? (schemaRecord.type === 'array' ? [] : {});
  const [text, setText] = useState(() =>
    JSON.stringify(data ?? fallback, null, 2),
  );
  const [error, setError] = useState<string | null>(null);

  const onChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const next = event.target.value;
    setText(next);
    try {
      handleChange(path, JSON.parse(next));
      setError(null);
    } catch {
      setError('Invalid JSON — not applied');
    }
  };

  return (
    <Flex vertical gap="small">
      <Typography.Text strong>{label}</Typography.Text>
      <textarea
        value={text}
        onChange={onChange}
        rows={12}
        spellCheck={false}
        style={{ fontFamily: 'monospace', fontSize: 12, width: '100%' }}
      />
      {error && <Typography.Text type="danger">{error}</Typography.Text>}
    </Flex>
  );
}

/** Native color picker for an `x-control: color` string field. */
function ColorControl({
  data,
  handleChange,
  path,
  schema,
  label,
}: ControlProps) {
  const theme = useTheme();
  const value = (data ??
    (schema as Record<string, unknown>).default ??
    theme.colorText) as string;
  return (
    <Flex align="center" gap="small">
      <input
        type="color"
        value={value}
        onChange={event => handleChange(path, event.target.value)}
      />
      <Typography.Text>{label}</Typography.Text>
    </Flex>
  );
}

/** Base Semantic-Layer renderers plus the widget-control code/color ones. */
export const schemaControlRenderers = [
  ...baseRenderers,
  {
    tester: rankWith(1000, xControlIs('code')),
    renderer: withJsonFormsControlProps(CodeControl),
  },
  {
    tester: rankWith(1000, xControlIs('color')),
    renderer: withJsonFormsControlProps(ColorControl),
  },
];

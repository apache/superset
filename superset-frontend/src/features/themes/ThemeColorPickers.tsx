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
import { useMemo } from 'react';
import { t } from '@apache-superset/core/translation';
import { styled } from '@apache-superset/core/theme';
import { Typography } from '@superset-ui/core/components/Typography';
import ColorPickerControl from 'src/explore/components/controls/ColorPickerControl';
import type { ColorPickerValue } from 'src/explore/components/controls/ColorPickerControl';

/**
 * Curated antd theme SEED tokens (plus a handful of the most load-bearing
 * MapToken/AliasToken derivatives) surfaced as individual color pickers, so
 * the common case -- "change the brand color" -- doesn't require pasting a
 * hand-edited JSON blob. This intentionally does not attempt to cover the
 * full antd token surface (100+ tokens): anything not listed here is still
 * fully editable via the JSON textarea below, which remains the source of
 * truth. Names are taken directly from antd's own `SeedToken` /
 * `MapToken` types -- see `antd/es/theme/interface/{seeds,maps/colors}.d.ts`
 * -- never invented.
 */
export const CURATED_COLOR_TOKENS = [
  { key: 'colorPrimary', label: () => t('Primary') },
  { key: 'colorSuccess', label: () => t('Success') },
  { key: 'colorWarning', label: () => t('Warning') },
  { key: 'colorError', label: () => t('Error') },
  { key: 'colorInfo', label: () => t('Info') },
  { key: 'colorLink', label: () => t('Link') },
  { key: 'colorText', label: () => t('Text') },
  { key: 'colorTextSecondary', label: () => t('Secondary text') },
  { key: 'colorBgBase', label: () => t('Base background') },
  { key: 'colorBgContainer', label: () => t('Container background') },
  { key: 'colorBorder', label: () => t('Border') },
] as const;

export type CuratedColorToken = (typeof CURATED_COLOR_TOKENS)[number]['key'];

interface ParsedThemeJson {
  token?: Record<string, unknown>;
  [key: string]: unknown;
}

/** Attempts to parse `jsonData` as a theme config object; returns `null`
 * (never throws) when the JSON is empty, mid-edit, or otherwise invalid --
 * matching the JSON-parse error handling already used elsewhere in
 * ThemeModal (`formatJsonData`, `isValidJson`). */
export const tryParseThemeJson = (
  jsonData: string | undefined,
): ParsedThemeJson | null => {
  if (!jsonData?.trim()) return null;
  try {
    const parsed = JSON.parse(jsonData);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

/** Patches a single curated token into `jsonData`'s `token` object,
 * preserving every other key (including tokens this UI doesn't curate) and
 * re-serializing with the same 2-space indent used throughout this modal. */
export const patchThemeJsonToken = (
  jsonData: string,
  key: CuratedColorToken,
  value: string,
): string => {
  const parsed = tryParseThemeJson(jsonData) ?? {};
  const next = {
    ...parsed,
    token: {
      ...parsed.token,
      [key]: value,
    },
  };
  return JSON.stringify(next, null, 2);
};

const TokenGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: ${({ theme }) => theme.sizeUnit * 3}px;
  margin-bottom: ${({ theme }) => theme.sizeUnit * 4}px;
`;

const TokenRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.sizeUnit * 2}px;
`;

interface ThemeColorPickersProps {
  jsonData: string;
  onChange: (nextJsonData: string) => void;
  disabled?: boolean;
}

export default function ThemeColorPickers({
  jsonData,
  onChange,
  disabled = false,
}: ThemeColorPickersProps) {
  const parsed = useMemo(() => tryParseThemeJson(jsonData), [jsonData]);
  const isValid = parsed !== null;
  const tokenValues = parsed?.token ?? {};

  const handleTokenChange =
    (key: CuratedColorToken) => (color: ColorPickerValue) => {
      if (typeof color !== 'string' || !isValid || disabled) return;
      onChange(patchThemeJsonToken(jsonData, key, color));
    };

  return (
    <div data-test="theme-color-pickers">
      {!isValid && (
        <Typography.Text
          type="secondary"
          data-test="theme-color-pickers-invalid-json-notice"
        >
          {t(
            'Fix the JSON errors below to edit colors here; your changes ' +
              'sync automatically once the JSON is valid again.',
          )}
        </Typography.Text>
      )}
      <TokenGrid>
        {CURATED_COLOR_TOKENS.map(({ key, label }) => {
          const tokenValue = tokenValues[key];
          return (
            <TokenRow key={key} data-test={`theme-color-picker-${key}`}>
              <Typography.Text>{label()}</Typography.Text>
              <ColorPickerControl
                ariaLabel={label()}
                value={typeof tokenValue === 'string' ? tokenValue : undefined}
                onChange={handleTokenChange(key)}
                outputFormat="hex"
              />
            </TokenRow>
          );
        })}
      </TokenGrid>
    </div>
  );
}

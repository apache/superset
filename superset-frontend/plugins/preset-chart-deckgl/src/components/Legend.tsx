/* eslint-disable react/jsx-sort-default-props */
/* eslint-disable react/sort-prop-types */
/* eslint-disable jsx-a11y/anchor-is-valid */
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
import { memo } from 'react';
import { formatNumber } from '@superset-ui/core';
import { styled } from '@apache-superset/core/theme';
import { Color } from '@deck.gl/core';

const StyledLegend = styled.div`
  ${({ theme }) => `
    font-size: ${theme.fontSizeSM}px;
    position: absolute;
    background: ${theme.colorBgElevated};
    box-shadow: 0 0 ${theme.sizeUnit}px ${theme.colorBorderSecondary};
    margin: ${theme.sizeUnit * 6}px;
    padding: ${theme.sizeUnit * 3}px ${theme.sizeUnit * 5}px;
    outline: none;
    overflow-y: scroll;
    max-height: 200px;
    border: 1px solid ${theme.colorBorder};
    border-radius: ${theme.borderRadius}px;

    & ul {
      list-style: none;
      padding-left: 0;
      margin: 0;

      & li a {
        display: flex;
        color: ${theme.colorText};
        text-decoration: none;
        padding: ${theme.sizeUnit}px 0;

        & span {
          margin-right: ${theme.sizeUnit}px;
        }
      }
    }
  `}
`;

const categoryDelimiter = ' - ';

const OPENING_BRACKETS = '[(';
const CLOSING_BRACKETS = '])';

// Recognize half-open interval labels like "[1, 81)" or "[81, 212]" emitted by
// getBuckets: brackets on the ends, two comma-separated bounds in between.
// Returns the parsed pieces, or null when the label isn't interval notation.
const parseInterval = (label: string) => {
  const open = label[0];
  const close = label[label.length - 1];
  if (!OPENING_BRACKETS.includes(open) || !CLOSING_BRACKETS.includes(close)) {
    return null;
  }

  const bounds = label.slice(1, -1).split(',');
  if (bounds.length !== 2) {
    return null;
  }

  const lower = bounds[0].trim();
  const upper = bounds[1].trim();
  if (!lower || !upper) {
    return null;
  }

  return { open, lower, upper, close };
};

export type LegendProps = {
  format: string | null;
  forceCategorical?: boolean;
  position?: null | 'tl' | 'tr' | 'bl' | 'br';
  categories: Record<string, { enabled: boolean; color: Color | undefined }>;
  toggleCategory?: (key: string) => void;
  showSingleCategory?: (key: string) => void;
};

const Legend = ({
  format: d3Format = null,
  forceCategorical = false,
  position = 'tr',
  categories: categoriesObject = {},
  toggleCategory = () => {},
  showSingleCategory = () => {},
}: LegendProps) => {
  const format = (value: string) => {
    if (!d3Format || forceCategorical) {
      return value;
    }

    const numValue = parseFloat(value);

    return formatNumber(d3Format, numValue);
  };

  const formatCategoryLabel = (k: string) => {
    if (!d3Format) {
      return k;
    }

    // Format each numeric bound of an interval label while preserving the
    // brackets and separator, e.g. "[1, 81)" -> "[1.00, 81.00)".
    const interval = parseInterval(k);
    if (interval) {
      const { open, lower, upper, close } = interval;

      return `${open}${format(lower)}, ${format(upper)}${close}`;
    }

    if (k.includes(categoryDelimiter)) {
      const values = k.split(categoryDelimiter);

      return format(values[0]) + categoryDelimiter + format(values[1]);
    }

    return format(k);
  };

  if (Object.keys(categoriesObject).length === 0 || position === null) {
    return null;
  }

  const categories = Object.entries(categoriesObject).map(([k, v]) => {
    const color = `rgba(${v.color?.join(', ')})`;
    // Render the swatch as a real coloured box rather than a colour-tinted
    // text glyph. U+25FC/U+25FB are in Unicode's Emoji set but lack
    // Emoji_Presentation, so Chromium resolves them to a colour-emoji font
    // whose glyphs carry baked-in colour and ignore the CSS `color` property,
    // producing a black square regardless of the category colour. A bordered
    // box has no such dependency: filled when enabled, hollow when disabled.
    const swatchStyle = {
      display: 'inline-block',
      width: '12px',
      height: '12px',
      border: `1px solid ${color}`,
      backgroundColor: v.enabled ? color : 'transparent',
      alignSelf: 'center',
      flex: '0 0 auto',
    };

    return (
      <li key={k}>
        <a
          href="#"
          role="button"
          onClick={e => {
            e.preventDefault();
            toggleCategory(k);
          }}
          onDoubleClick={e => {
            e.preventDefault();
            showSingleCategory(k);
          }}
        >
          <span aria-hidden style={swatchStyle} /> {formatCategoryLabel(k)}
        </a>
      </li>
    );
  });

  const vertical = position?.charAt(0) === 't' ? 'top' : 'bottom';
  const horizontal = position?.charAt(1) === 'r' ? 'right' : 'left';
  const style = {
    position: 'absolute' as const,
    [vertical]: '0px',
    [horizontal]: '10px',
  };

  return (
    <StyledLegend style={style}>
      <ul>{categories}</ul>
    </StyledLegend>
  );
};

export default memo(Legend);

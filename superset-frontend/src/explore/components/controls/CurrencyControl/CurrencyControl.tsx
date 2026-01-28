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
import { useCallback, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { t } from '@apache-superset/core';
import { Currency, ensureIsArray, getCurrencySymbol } from '@superset-ui/core';
import { css, styled, useTheme } from '@apache-superset/core/ui';
import { CSSObject } from '@emotion/react';
import { Select, type SelectProps } from '@superset-ui/core/components';
import { ViewState } from 'src/views/types';
import { ExplorePageState } from 'src/explore/types';
import ControlHeader from '../../ControlHeader';

export interface CurrencyControlProps {
  onChange: (currency: Partial<Currency>) => void;
  value?: Partial<Currency> | string | null;
  symbolSelectOverrideProps?: Partial<SelectProps>;
  currencySelectOverrideProps?: Partial<SelectProps>;
  symbolSelectAdditionalStyles?: CSSObject;
  currencySelectAdditionalStyles?: CSSObject;
}

const CurrencyControlContainer = styled.div`
  ${({ theme }) => css`
    display: flex;
    align-items: center;

    & > :first-child {
      margin-right: ${theme.sizeUnit * 4}px;
      min-width: 0;
      flex: 1;
    }

    & > :nth-child(2) {
      min-width: 0;
      flex: 1;
    }
  `}
`;

export const CURRENCY_SYMBOL_POSITION_OPTIONS = [
  { value: 'prefix', label: t('Prefix') },
  { value: 'suffix', label: t('Suffix') },
];

const isCurrencyObject = (value: unknown): value is Partial<Currency> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

export const CurrencyControl = ({
  onChange,
  value: rawCurrency = {},
  symbolSelectOverrideProps = {},
  currencySelectOverrideProps = {},
  symbolSelectAdditionalStyles,
  currencySelectAdditionalStyles,
  ...props
}: CurrencyControlProps) => {
  const theme = useTheme();
  const normalizedCurrency = useMemo<Partial<Currency>>(() => {
    if (isCurrencyObject(rawCurrency)) {
      return rawCurrency;
    }

    if (typeof rawCurrency === 'string') {
      try {
        const parsed = JSON.parse(rawCurrency) as unknown;
        if (isCurrencyObject(parsed)) {
          return parsed;
        }
      } catch {
        return {};
      }
    }

    return {};
  }, [rawCurrency]);
  const currencies = useSelector<ViewState, string[]>(
    state => state.common?.currencies,
  );
  const currencyCodeColumn = useSelector<ExplorePageState, string | undefined>(
    state => state?.explore?.datasource?.currency_code_column,
  );

  const currenciesOptions = useMemo(() => {
    const options = ensureIsArray(currencies).map(currencyCode => ({
      value: currencyCode,
      label: `${getCurrencySymbol({
        symbol: currencyCode,
      })} (${currencyCode})`,
    }));

    const autoDetectOption = currencyCodeColumn
      ? [
          {
            value: 'AUTO',
            label: t('Auto-detect'),
            className: 'currency-auto-detect-option',
          },
        ]
      : [];

    return [
      ...autoDetectOption,
      ...options,
      { value: '', label: t('Custom...') },
    ];
  }, [currencies, currencyCodeColumn]);

  const currencySortComparator = useCallback(
    (
      a: { value?: string | number },
      b: { value?: string | number },
    ): number => {
      if (a.value === 'AUTO') return -1;
      if (b.value === 'AUTO') return 1;
      if (a.value === '') return 1;
      if (b.value === '') return -1;
      const labelA = String(a.value ?? '');
      const labelB = String(b.value ?? '');
      return labelA.localeCompare(labelB);
    },
    [],
  );

  const renderCurrencyPopup = useMemo(
    () =>
      currencyCodeColumn
        ? (menu: React.ReactNode) => (
            <div
              css={css`
                .currency-auto-detect-option {
                  border-bottom: 1px solid ${theme.colorBorderSecondary};
                  margin-bottom: ${theme.sizeUnit}px;
                }
              `}
            >
              {menu}
            </div>
          )
        : undefined,
    [currencyCodeColumn, theme],
  );

  return (
    <>
      <ControlHeader {...props} />
      <CurrencyControlContainer
        css={css`
          & > :first-child {
            ${symbolSelectAdditionalStyles};
          }
          & > :nth-child(2) {
            ${currencySelectAdditionalStyles};
          }
        `}
        data-test="currency-control-container"
      >
        <Select
          ariaLabel={t('Currency prefix or suffix')}
          options={CURRENCY_SYMBOL_POSITION_OPTIONS}
          placeholder={t('Prefix or suffix')}
          onChange={(symbolPosition: string) => {
            onChange({ ...normalizedCurrency, symbolPosition });
          }}
          onClear={() =>
            onChange({ ...normalizedCurrency, symbolPosition: undefined })
          }
          value={normalizedCurrency?.symbolPosition}
          allowClear
          {...symbolSelectOverrideProps}
        />
        <Select
          ariaLabel={t('Currency symbol')}
          options={currenciesOptions}
          placeholder={t('Currency')}
          onChange={(symbol: string) => {
            onChange({ ...normalizedCurrency, symbol });
          }}
          onClear={() => onChange({ ...normalizedCurrency, symbol: undefined })}
          value={normalizedCurrency?.symbol}
          allowClear
          allowNewOptions
          sortComparator={currencySortComparator}
          popupRender={renderCurrencyPopup}
          {...currencySelectOverrideProps}
        />
      </CurrencyControlContainer>
    </>
  );
};

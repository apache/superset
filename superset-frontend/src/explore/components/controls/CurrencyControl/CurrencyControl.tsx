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
import React, { useMemo } from 'react';
import { useSelector } from 'react-redux';
import {
  css,
  Currency,
  ensureIsArray,
  getCurrencySymbol,
  styled,
  t,
} from '@superset-ui/core';
import { CSSObject } from '@emotion/react';
import { Select } from 'src/components';
import { ViewState } from 'src/views/types';
import { SelectProps } from 'src/components/Select/types';
import ControlHeader from '../../ControlHeader';

export interface CurrencyControlProps {
  onChange: (currency: Partial<Currency>) => void;
  value?: Partial<Currency>;
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
      margin-right: ${theme.gridUnit * 4}px;
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

export const CurrencyControl = ({
  onChange,
  value: currency = {},
  symbolSelectOverrideProps = {},
  currencySelectOverrideProps = {},
  symbolSelectAdditionalStyles,
  currencySelectAdditionalStyles,
  ...props
}: CurrencyControlProps) => {
  const currencies = useSelector<ViewState, string[]>(
    state => state.common?.currencies,
  );
  const currenciesOptions = useMemo(
    () =>
      ensureIsArray(currencies).map(currencyCode => ({
        value: currencyCode,
        label: `${getCurrencySymbol({
          symbol: currencyCode,
        })} (${currencyCode})`,
      })),
    [currencies],
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
        className="currency-control-container"
      >
        <Select
          ariaLabel={t('Currency prefix or suffix')}
          options={CURRENCY_SYMBOL_POSITION_OPTIONS}
          placeholder={t('Prefix or suffix')}
          onChange={(symbolPosition: string) => {
            onChange({ ...currency, symbolPosition });
          }}
          onClear={() => onChange({ ...currency, symbolPosition: undefined })}
          value={currency?.symbolPosition}
          allowClear
          {...symbolSelectOverrideProps}
        />
        <Select
          ariaLabel={t('Currency symbol')}
          options={currenciesOptions}
          placeholder={t('Currency')}
          onChange={(symbol: string) => {
            onChange({ ...currency, symbol });
          }}
          onClear={() => onChange({ ...currency, symbol: undefined })}
          value={currency?.symbol}
          allowClear
          allowNewOptions
          {...currencySelectOverrideProps}
        />
      </CurrencyControlContainer>
    </>
  );
};

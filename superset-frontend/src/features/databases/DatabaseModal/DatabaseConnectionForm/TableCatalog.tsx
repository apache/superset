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
import { css, SupersetTheme, t } from '@superset-ui/core';
import ValidatedInput from 'src/components/Form/LabeledErrorBoundInput';
import FormLabel from 'src/components/Form/FormLabel';
import Icons from 'src/components/Icons';
import { StyledFooterButton, StyledCatalogTable } from '../styles';
import { CatalogObject, FieldPropTypes } from '../../types';

export const TableCatalog = ({
  required,
  changeMethods,
  getValidation,
  validationErrors,
  db,
}: FieldPropTypes) => {
  const tableCatalog = db?.catalog || [];
  const catalogError = validationErrors || {};
  return (
    <StyledCatalogTable>
      <h4 className="gsheet-title">
        {t('Connect Google Sheets as tables to this database')}
      </h4>
      <div>
        {tableCatalog?.map((sheet: CatalogObject, idx: number) => (
          <>
            <FormLabel className="catalog-label">
              {t('Google Sheet Name and URL')}
            </FormLabel>
            <div className="catalog-name">
              <ValidatedInput
                className="catalog-name-input"
                required={required}
                validationMethods={{ onBlur: getValidation }}
                errorMessage={catalogError[idx]?.name}
                placeholder={t('Enter a name for this sheet')}
                onChange={(e: { target: { value: any } }) => {
                  changeMethods.onParametersChange({
                    target: {
                      type: `catalog-${idx}`,
                      name: 'name',
                      value: e.target.value,
                    },
                  });
                }}
                value={sheet.name}
              />
              {tableCatalog?.length > 1 && (
                <Icons.CloseOutlined
                  css={(theme: SupersetTheme) => css`
                    align-self: center;
                    background: ${theme.colors.grayscale.light4};
                    margin: 5px 5px 8px 5px;

                    &.anticon > * {
                      line-height: 0;
                    }
                  `}
                  iconSize="m"
                  onClick={() => changeMethods.onRemoveTableCatalog(idx)}
                />
              )}
            </div>
            <ValidatedInput
              className="catalog-name-url"
              required={required}
              validationMethods={{ onBlur: getValidation }}
              errorMessage={catalogError[idx]?.url}
              placeholder={t('Paste the shareable Google Sheet URL here')}
              onChange={(e: { target: { value: any } }) =>
                changeMethods.onParametersChange({
                  target: {
                    type: `catalog-${idx}`,
                    name: 'value',
                    value: e.target.value,
                  },
                })
              }
              value={sheet.value}
            />
          </>
        ))}
        <StyledFooterButton
          className="catalog-add-btn"
          onClick={() => {
            changeMethods.onAddTableCatalog();
          }}
        >
          + {t('Add sheet')}
        </StyledFooterButton>
      </div>
      <div className="helper">
        <div>
          {t(
            'In order to connect to non-public sheets you need to either provide a service account or configure an OAuth2 client.',
          )}
        </div>
      </div>
    </StyledCatalogTable>
  );
};

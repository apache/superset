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
import { t, useTheme, css, styled } from '@superset-ui/core';
import { useEffect, useState } from 'react';
import { Checkbox, Icons } from '@superset-ui/core/components';

const Container = styled.div`
  ${({ theme }) => css`
    width: 100%;
    margin: 0 auto;
    padding: ${theme.sizeUnit * 1.5}px ${theme.sizeUnit * 2}px;
    border-style: none;
    border: 1px solid ${theme.colors.grayscale.light2};
    border-radius: ${theme.sizeUnit}px;

    input {
      flex-grow: 0;
    }
  `}
`;

const SchemaList = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit * 2}px;
  `}
`;

const SchemaItem = styled.div`
  ${({ theme }) => css`
    border-bottom: 1px solid ${theme.colors.grayscale.light2};
    padding-bottom: ${theme.sizeUnit * 1.5}px;
  `}
`;

const SchemaHeader = styled.div`
  display: flex;
  align-items: center;
`;

const CaretButton = styled.button`
  ${({ theme }) => css`
    margin-right: ${theme.sizeUnit * 2}px;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;

    &:focus {
      outline: none;
    }
  `}
`;

const EmptyCaret = styled.div`
  ${({ theme }) => css`
    width: 14px;
    height: 14px;
    margin-right: ${theme.sizeUnit * 2}px;
    padding: 0;
  `}
`;

const CheckboxContainer = styled.div`
  display: flex;
  align-items: center;

  label {
    font-weight: 500;
    cursor: pointer;
  }

  label.disabled {
    font-weight: 400;
    color: ${props => props.theme.colors.grayscale.light1};
  }
`;

const TablesList = styled.div`
  ${({ theme }) => css`
    margin-left: ${theme.sizeUnit * 8}px;
    margin-top: ${theme.sizeUnit}px;
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit}px;
  `}
`;

const TableItem = styled.div`
  display: flex;
  align-items: center;
`;

const StatusBar = styled.div`
  ${({ theme }) => css`
    margin-top: ${theme.sizeUnit * 2}px;
    font-size: 0.875rem;
    color: ${theme.colors.grayscale.dark1};
  `}
`;

const Header = styled.div`
  ${({ theme }) => css`
    margin-bottom: ${theme.sizeUnit * 2}px;
    font-size: ${theme.fontSizeSM}px;
    font-weight: 600;
    color: ${theme.colors.grayscale.dark1};
    display: flex;

    div {
      border-right: 1px solid ${theme.colors.grayscale.light2};
      padding-right: ${theme.sizeUnit * 2}px;
      padding-left: ${theme.sizeUnit * 2}px;

      &:first-child {
        padding-left: 0;
      }

      &:last-child {
        border-right: none;
      }
    }
  `}
`;

const LoadingContainer = styled.div`
  ${({ theme }) => css`
    display: flex;
    align-items: center;
    gap: ${theme.sizeUnit}px;

    span {
      margin-left: ${theme.sizeUnit * 2}px;
    }
  `}
`;

const SchemaSelector = ({
  value,
  options,
  loading,
  error,
  onSchemasChange,
  maxContentHeight = null,
}: {
  value: string[];
  options: Record<string, string[]>;
  loading: boolean;
  error: Error | null;
  onSchemasChange: Function;
  maxContentHeight?: number | null;
}) => {
  const theme = useTheme();
  const [expandedSchema, setExpandedSchema] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<{
    [key: string]: boolean;
  }>({});
  const [filterText, setFilterText] = useState('');
  const [filteredOptions, setFilteredOptions] = useState<
    Record<string, string[]>
  >({});
  useEffect(() => {
    const filtered = filterText
      ? Object.keys(options).reduce(
          (acc, schema) => {
            const filteredTables = options[schema].filter(table =>
              table.toLowerCase().includes(filterText.toLowerCase()),
            );
            if (filteredTables.length > 0) {
              acc[schema] = filteredTables;
            }
            return acc;
          },
          {} as Record<string, string[]>,
        )
      : options;
    setFilteredOptions(filtered);
  }, [options, filterText]);

  useEffect(() => {
    const initialSelections: { [key: string]: boolean } = {};
    Object.keys(options).forEach(schema => {
      options[schema].forEach(table => {
        initialSelections[`${schema}.${table}`] =
          value.indexOf(`${schema}.${table}`) !== -1;
      });
    });
    setSelectedItems(initialSelections);
  }, [options, value]);

  const areAllChildrenSelected = (schema: string) => {
    if (options[schema].length === 0) {
      return false;
    }
    return options[schema].every(table => selectedItems[`${schema}.${table}`]);
  };

  const areSomeChildrenSelected = (schema: string) =>
    options[schema].some(table => selectedItems[`${schema}.${table}`]) &&
    !areAllChildrenSelected(schema);

  const toggleExpanded = (schema: string) => {
    setExpandedSchema(expandedSchema === schema ? null : schema);
  };

  const handleSchemaCheckboxChange = (schema: string) => {
    const newSelectedItems = { ...selectedItems };
    const newValue = !areAllChildrenSelected(schema);

    options[schema].forEach(table => {
      newSelectedItems[`${schema}.${table}`] = newValue;
    });

    onSchemasChange(selectedItemsToValue(newSelectedItems));
  };

  const handleChildCheckboxChange = (schema: string, table: string) => {
    const newSelectedItems = { ...selectedItems };
    const key = `${schema}.${table}`;

    newSelectedItems[key] = !newSelectedItems[key];

    onSchemasChange(selectedItemsToValue(newSelectedItems));
  };

  const handleSelectAll = () => {
    setAll(true);
  };
  const handleUnselectAll = () => {
    setAll(false);
  };
  const setAll = (selected: boolean) => {
    const newSelectedItems = { ...selectedItems };
    Object.keys(newSelectedItems).forEach(key => {
      newSelectedItems[key] = selected;
    });
    setSelectedItems(newSelectedItems);
    onSchemasChange(selectedItemsToValue(newSelectedItems));
  };

  const selectedItemsToValue = (selected: { [key: string]: boolean }) => {
    const value = [];
    for (const key in selected) {
      if (selected[key]) {
        value.push(key);
      }
    }
    return value;
  };

  return (
    <Container>
      {loading ? (
        <LoadingContainer>
          <Icons.LoadingOutlined />
          <span>{t('Loading schemas and tables...')}</span>
        </LoadingContainer>
      ) : error ? (
        <p>
          {t('An error occurred while retrieving schemas for this connection')}
        </p>
      ) : (
        <>
          <Header>
            <div>
              <a onClick={handleSelectAll}>Select all</a>
            </div>
            <div>
              <a onClick={handleUnselectAll}>Select none</a>
            </div>
            <div style={{ flex: 1, textAlign: 'right' }}>
              <input
                type="text"
                placeholder={t('Filter tables')}
                style={{
                  padding: '2px 8px',
                  border: 'none',
                  borderRadius: 0,
                  borderBottom: `1px solid ${theme.colors.grayscale.light2}`,
                  minWidth: 180,
                }}
                value={filterText}
                onChange={e => setFilterText(e.target.value)}
                aria-label={t('Filter tables')}
              />
            </div>
          </Header>

          <SchemaList
            style={
              maxContentHeight !== null
                ? {
                    maxHeight: maxContentHeight,
                    overflowY: 'auto',
                    marginRight: `-${theme.sizeUnit * 2}px`,
                    paddingRight: `${theme.sizeUnit * 2}px`,
                  }
                : undefined
            }
          >
            {Object.keys(filteredOptions).map(schema => (
              <SchemaItem key={schema}>
                <SchemaHeader>
                  {filteredOptions[schema].length > 0 ? (
                    <CaretButton
                      onClick={() => toggleExpanded(schema)}
                      aria-label={
                        expandedSchema === schema ? 'Collapse' : 'Expand'
                      }
                    >
                      {expandedSchema === schema ? (
                        <Icons.CaretDownFilled size={18} />
                      ) : (
                        <Icons.CaretRightFilled size={18} />
                      )}
                    </CaretButton>
                  ) : (
                    <EmptyCaret />
                  )}

                  <CheckboxContainer>
                    <Checkbox
                      id={`schema-${schema}`}
                      checked={areAllChildrenSelected(schema)}
                      indeterminate={areSomeChildrenSelected(schema)}
                      onChange={() => handleSchemaCheckboxChange(schema)}
                    />
                    <label
                      htmlFor={`schema-${schema}`}
                      className={options[schema].length === 0 ? 'disabled' : ''}
                      onClick={() =>
                        options[schema].length > 0 && toggleExpanded(schema)
                      }
                    >
                      {schema}
                    </label>
                  </CheckboxContainer>
                </SchemaHeader>

                {expandedSchema === schema && (
                  <TablesList>
                    {filteredOptions[schema].map(table => (
                      <TableItem key={table}>
                        <Checkbox
                          id="`${schema}-${table}`"
                          indeterminate={false}
                          checked={selectedItems[`${schema}.${table}`] || false}
                          onChange={() =>
                            handleChildCheckboxChange(schema, table)
                          }
                        >
                          {table}
                        </Checkbox>
                      </TableItem>
                    ))}
                  </TablesList>
                )}
              </SchemaItem>
            ))}
          </SchemaList>

          <StatusBar>
            {Object.values(selectedItems).filter(Boolean).length} items selected
          </StatusBar>
        </>
      )}
    </Container>
  );
};

export default SchemaSelector;

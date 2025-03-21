import {
  t,
} from '@superset-ui/core';
import React, { useEffect, useState } from 'react';
import {
  CaretDownFilled,
  CaretRightFilled,
  LoadingOutlined
} from '@ant-design/icons';
import { css, styled } from '@superset-ui/core';
import IndeterminateCheckbox from 'src/components/IndeterminateCheckbox';

const Container = styled.div`
  ${({ theme }) => css`  
    width: 100%;
    margin: 0 auto;
    padding: ${theme.gridUnit * 1.5}px ${theme.gridUnit * 2}px;
    border-style: none;
    border: 1px solid ${theme.colors.grayscale.light2};
    border-radius: ${theme.gridUnit}px;
  
    input {
      flex-grow: 0;
    }
  `}
`;

const SchemaList = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-direction: column;
    gap: ${theme.gridUnit * 2}px;
  `}
`;

const SchemaItem = styled.div`
  ${({ theme }) => css`
    border-bottom: 1px solid ${theme.colors.grayscale.light2};
    padding-bottom: ${theme.gridUnit * 1.5}px;
  `}
`;

const SchemaHeader = styled.div`
  display: flex;
  align-items: center;
`;

const CaretButton = styled.button`
  ${({ theme }) => css`
    margin-right: ${theme.gridUnit * 2}px;
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

const CheckboxContainer = styled.div`
  display: flex;
  align-items: center;
`;

const SchemaLabel = styled.label`
  font-weight: 500;
  cursor: pointer;
`;

const TablesList = styled.div`
  ${({ theme }) => css`
    margin-left: ${theme.gridUnit * 8}px;
    margin-top: ${theme.gridUnit}px;
    display: flex;
    flex-direction: column;
    gap: ${theme.gridUnit}px;
  `}
`;

const TableItem = styled.div`
  display: flex;
  align-items: center;
`;

const StatusBar = styled.div`
  ${({ theme }) => css`
    margin-top: ${theme.gridUnit * 2}px;
    font-size: 0.875rem;
    color: ${theme.colors.grayscale.dark1};
  `}
`;

const LoadingContainer = styled.div`
  ${({ theme }) => css`
    display: flex;
    align-items: center;
    gap: ${theme.gridUnit}px;

    span {
      margin-left: ${theme.gridUnit * 2}px;
    }
  `}
`;

const SchemaSelector = ({
  value,
  options,
  loading,
  error,
  onSchemasChange,
}: {
  value: string[];
  options: Record<string, string[]>;
  loading: boolean;
  error: Error | null;
  onSchemasChange: Function;
}) => {
  const [expandedSchema, setExpandedSchema] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<{[key: string]: boolean}>({});

  useEffect(() => {
    const initialSelections: {[key: string]: boolean} = {};
    Object.keys(options).forEach(schema => {
      options[schema].forEach(table => {
        initialSelections[`${schema}.${table}`] = value.indexOf(`${schema}.${table}`) !== -1;
      });
    });
    setSelectedItems(initialSelections);
  }, [options, value]);

  const areAllChildrenSelected = (schema: string) => {
    return options[schema].every(
      table => selectedItems[`${schema}.${table}`]
    );
  };

  const areSomeChildrenSelected = (schema: string) => {
    return options[schema].some(
      table => selectedItems[`${schema}.${table}`]
    ) && !areAllChildrenSelected(schema);
  };

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

  const selectedItemsToValue = (selected: {[key: string]: boolean}) => {
    const value = []
    for (const key in selected) {
      if (selected[key]) {
        value.push(key);
      }
    }
    return value;
  };
  
  return (
    <Container>
      { loading && (
        <LoadingContainer>
          <LoadingOutlined/>
          <span>{t('Loading schemas and tables...')}</span>
        </LoadingContainer>
      )}
      { error && <p>{t('An error occurred while retrieving schemas for this connection')}</p> }
      <SchemaList>
        {Object.keys(options).map(schema => (
          <SchemaItem key={schema}>
            <SchemaHeader>
              <CaretButton 
                onClick={() => toggleExpanded(schema)}
                aria-label={expandedSchema === schema ? "Collapse" : "Expand"}
              >
                {expandedSchema === schema ? 
                  <CaretDownFilled size={18} /> : 
                  <CaretRightFilled size={18} />
                }
              </CaretButton>
              
              <CheckboxContainer>
                <IndeterminateCheckbox
                  id={`schema-${schema}`}
                  checked={areAllChildrenSelected(schema)}
                  indeterminate={areSomeChildrenSelected(schema)}
                  onChange={() => handleSchemaCheckboxChange(schema)}
                />
                <SchemaLabel 
                  htmlFor={`schema-${schema}`} 
                  onClick={() => toggleExpanded(schema)}
                >
                  {schema}
                </SchemaLabel>
              </CheckboxContainer>
            </SchemaHeader>
            
            {expandedSchema === schema && (
              <TablesList>
                {options[schema].map(table => (
                  <TableItem key={table}>
                    <IndeterminateCheckbox
                      id="`${schema}-${table}`"
                      indeterminate={false}
                      checked={selectedItems[`${schema}.${table}`] || false}
                      onChange={() => handleChildCheckboxChange(schema, table)}
                      labelText={table}
                    />
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
    </Container>
  )
};

export default SchemaSelector;

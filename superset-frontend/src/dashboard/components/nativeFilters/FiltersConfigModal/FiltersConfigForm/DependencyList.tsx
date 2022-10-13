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
import React, { useState } from 'react';
import { styled, t } from '@superset-ui/core';
import Icons from 'src/components/Icons';
import { Select } from 'src/components';
import { CollapsibleControl } from './CollapsibleControl';

interface DependencyListProps {
  availableFilters: { label: string; value: string }[];
  dependencies: string[];
  onDependenciesChange: (dependencies: string[]) => void;
  getDependencySuggestion: () => string;
}

const MainPanel = styled.div`
  display: flex;
  flex-direction: column;
`;

const AddFilter = styled.div`
  ${({ theme }) => `
    display: inline-flex;
    flex-direction: row;
    align-items: center;
    cursor: pointer;
    color: ${theme.colors.primary.base};
    &:hover {
      color: ${theme.colors.primary.dark1};
    }
  `}
`;

const DeleteFilter = styled(Icons.Trash)`
  ${({ theme }) => `
    cursor: pointer;
    margin-left: ${theme.gridUnit * 2}px;
    color: ${theme.colors.grayscale.base};
    &:hover {
      color: ${theme.colors.grayscale.dark1};
    }
  `}
`;

const RowPanel = styled.div`
  ${({ theme }) => `
    display: flex;
    width: 220px;
    flex-direction: row;
    align-items: center;
    margin-bottom: ${theme.gridUnit}px;
  `}
`;

const Label = styled.div`
  text-transform: uppercase;
  font-size: ${({ theme }) => theme.typography.sizes.s}px;
  color: ${({ theme }) => theme.colors.grayscale.base};
  margin-bottom: ${({ theme }) => theme.gridUnit}px;
`;

const Row = ({
  availableFilters,
  selection,
  onChange,
  onDelete,
}: {
  availableFilters: { label: string; value: string }[];
  selection: string;
  onChange: (id: string, value: string) => void;
  onDelete: (id: string) => void;
}) => {
  let value = availableFilters.find(e => e.value === selection);
  let options = availableFilters;
  if (!value) {
    value = { label: t('(deleted or invalid type)'), value: selection };
    options = [value, ...options];
  }
  return (
    <RowPanel>
      <Select
        ariaLabel={t('Limit type')}
        labelInValue
        options={options}
        onChange={option =>
          onChange(selection, (option as { value: string }).value)
        }
        value={value}
      />
      <DeleteFilter iconSize="xl" onClick={() => onDelete(selection)} />
    </RowPanel>
  );
};

const List = ({
  availableFilters = [],
  dependencies = [],
  onDependenciesChange,
}: DependencyListProps) => {
  const [rows, setRows] = useState<string[]>(dependencies);

  const updateRows = (newRows: string[]) => {
    setRows(newRows);
    onDependenciesChange(newRows);
  };

  const onAdd = () => {
    const filter = availableFilters.find(
      availableFilter => !rows.includes(availableFilter.value),
    );
    if (filter) {
      const newRows = [...rows];
      newRows.push(filter.value);
      updateRows(newRows);
    }
  };

  const onChange = (id: string, value: string) => {
    const indexOf = rows.findIndex(row => row === id);
    const newRows = [...rows];
    newRows[indexOf] = value;
    updateRows(newRows);
  };

  const onDelete = (id: string) => {
    const newRows = [...rows];
    newRows.splice(rows.indexOf(id), 1);
    updateRows(newRows);
  };

  if (availableFilters.length === 0) {
    return <span>{t('No available filters.')}</span>;
  }

  return (
    <>
      {rows.map(row => (
        <Row
          key={row}
          selection={row}
          availableFilters={availableFilters.filter(
            e => e.value === row || !rows.includes(e.value),
          )}
          onChange={onChange}
          onDelete={onDelete}
        />
      ))}
      {availableFilters.length > rows.length && (
        <AddFilter onClick={onAdd}>
          <Icons.PlusSmall />
          {t('Add filter')}
        </AddFilter>
      )}
    </>
  );
};

const DependencyList = ({
  availableFilters = [],
  dependencies = [],
  onDependenciesChange,
  getDependencySuggestion,
}: DependencyListProps) => {
  const hasAvailableFilters = availableFilters.length > 0;
  const hasDependencies = dependencies.length > 0;

  const onCheckChanged = (value: boolean) => {
    const newDependencies: string[] = [];
    if (value && !hasDependencies && hasAvailableFilters) {
      newDependencies.push(getDependencySuggestion());
    }
    onDependenciesChange(newDependencies);
  };

  return (
    <MainPanel>
      <CollapsibleControl
        title={t('Values are dependent on other filters')}
        initialValue={hasDependencies}
        onChange={onCheckChanged}
        tooltip={t(
          'Values selected in other filters will affect the filter options to only show relevant values',
        )}
      >
        {hasDependencies && <Label>{t('Values dependent on')}</Label>}
        <List
          availableFilters={availableFilters}
          dependencies={dependencies}
          onDependenciesChange={onDependenciesChange}
          getDependencySuggestion={getDependencySuggestion}
        />
      </CollapsibleControl>
    </MainPanel>
  );
};

export default DependencyList;

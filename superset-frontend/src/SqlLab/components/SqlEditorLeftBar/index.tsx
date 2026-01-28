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
import { useCallback, useState } from 'react';
import { useDispatch } from 'react-redux';

import { resetState } from 'src/SqlLab/actions/sqlLab';
import {
  Button,
  EmptyState,
  Icons,
  Popconfirm,
} from '@superset-ui/core/components';
import { t } from '@apache-superset/core';
import { styled, css } from '@apache-superset/core/ui';
import type { SchemaOption, CatalogOption } from 'src/hooks/apiResources';
import { DatabaseSelector, type DatabaseObject } from 'src/components';

import useDatabaseSelector from '../SqlEditorTopBar/useDatabaseSelector';
import TableExploreTree from '../TableExploreTree';

export interface SqlEditorLeftBarProps {
  queryEditorId: string;
}

const LeftBarStyles = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.sizeUnit * 2}px;

  ${({ theme }) => css`
    height: 100%;
    display: flex;
    flex-direction: column;

    .divider {
      border-bottom: 1px solid ${theme.colorSplit};
      margin: ${theme.sizeUnit * 1}px 0;
    }
  `}
`;

const StyledDivider = styled.div`
  border-bottom: 1px solid ${({ theme }) => theme.colorSplit};
  margin: 0 -${({ theme }) => theme.sizeUnit * 2.5}px 0;
`;

const SqlEditorLeftBar = ({ queryEditorId }: SqlEditorLeftBarProps) => {
  const dbSelectorProps = useDatabaseSelector(queryEditorId);
  const { db, catalog, schema, onDbChange, onCatalogChange, onSchemaChange } =
    dbSelectorProps;

  const dispatch = useDispatch();
  const shouldShowReset = window.location.search === '?reset=1';

  // Modal state for Database/Catalog/Schema selector
  const [selectorModalOpen, setSelectorModalOpen] = useState(false);
  const [modalDb, setModalDb] = useState<DatabaseObject | undefined>(undefined);
  const [modalCatalog, setModalCatalog] = useState<
    CatalogOption | null | undefined
  >(undefined);
  const [modalSchema, setModalSchema] = useState<SchemaOption | undefined>(
    undefined,
  );

  const openSelectorModal = useCallback(() => {
    setModalDb(db ?? undefined);
    setModalCatalog(
      catalog ? { label: catalog, value: catalog, title: catalog } : undefined,
    );
    setModalSchema(
      schema ? { label: schema, value: schema, title: schema } : undefined,
    );
    setSelectorModalOpen(true);
  }, [db, catalog, schema]);

  const closeSelectorModal = useCallback(() => {
    setSelectorModalOpen(false);
  }, []);

  const handleModalOk = useCallback(() => {
    if (modalDb && modalDb.id !== db?.id) {
      onDbChange?.(modalDb);
    }
    if (modalCatalog?.value !== catalog) {
      onCatalogChange?.(modalCatalog?.value);
    }
    if (modalSchema?.value !== schema) {
      onSchemaChange?.(modalSchema?.value ?? '');
    }
    setSelectorModalOpen(false);
  }, [
    modalDb,
    modalCatalog,
    modalSchema,
    db,
    catalog,
    schema,
    onDbChange,
    onCatalogChange,
    onSchemaChange,
  ]);

  const handleResetState = useCallback(() => {
    dispatch(resetState());
  }, [dispatch]);

  const popconfirmDescription = (
    <div
      data-test="DatabaseSelector"
      css={css`
        min-width: 500px;
      `}
    >
      <DatabaseSelector
        key={modalDb ? modalDb.id : 'no-db'}
        db={modalDb}
        emptyState={<EmptyState />}
        getDbList={dbSelectorProps.getDbList}
        handleError={dbSelectorProps.handleError}
        onDbChange={setModalDb}
        onCatalogChange={cat =>
          setModalCatalog(
            cat ? { label: cat, value: cat, title: cat } : undefined,
          )
        }
        catalog={modalCatalog?.value}
        onSchemaChange={sch =>
          setModalSchema(
            sch ? { label: sch, value: sch, title: sch } : undefined,
          )
        }
        schema={modalSchema?.value}
        sqlLabMode={false}
      />
    </div>
  );

  return (
    <LeftBarStyles data-test="sql-editor-left-bar">
      <Popconfirm
        title={t('Select Database and Schema')}
        description={popconfirmDescription}
        open={selectorModalOpen}
        onOpenChange={open => !open && closeSelectorModal()}
        onConfirm={e => {
          e?.stopPropagation();
          handleModalOk();
        }}
        onCancel={e => {
          e?.stopPropagation();
          closeSelectorModal();
        }}
        okText={t('Select')}
        cancelText={t('Cancel')}
        placement="bottomLeft"
        icon={null}
      >
        <div>
          <DatabaseSelector
            key={`db-selector-${db ? db.id : 'no-db'}:${catalog ?? 'no-catalog'}:${
              schema ?? 'no-schema'
            }`}
            {...dbSelectorProps}
            emptyState={<EmptyState />}
            sqlLabMode
            onOpenModal={openSelectorModal}
          />
        </div>
      </Popconfirm>
      <StyledDivider />
      <TableExploreTree queryEditorId={queryEditorId} />
      {shouldShowReset && (
        <Button
          buttonSize="small"
          buttonStyle="danger"
          onClick={handleResetState}
        >
          <Icons.ClearOutlined /> {t('Reset state')}
        </Button>
      )}
    </LeftBarStyles>
  );
};

export default SqlEditorLeftBar;

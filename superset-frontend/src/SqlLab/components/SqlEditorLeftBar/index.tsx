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

import {
  resetState,
  addQueryEditor,
} from 'src/SqlLab/actions/sqlLab';
import {
  Button,
  Divider,
  EmptyState,
  Flex,
  Icons,
  Label,
  Popover,
  Typography,
} from '@superset-ui/core/components';
import { t } from '@apache-superset/core';
import { styled } from '@apache-superset/core/ui';
import type { SchemaOption, CatalogOption } from 'src/hooks/apiResources';
import { DatabaseSelector, type DatabaseObject } from 'src/components';

import useDatabaseSelector from '../SqlEditorTopBar/useDatabaseSelector';
import TableExploreTree from '../TableExploreTree';

export interface SqlEditorLeftBarProps {
  queryEditorId: string;
}

const LeftBarStyles = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.sizeUnit * 2}px;
`;

const SelectorTrigger = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.sizeUnit}px;
  min-width: 0;
  overflow: hidden;
  padding: ${({ theme }) => theme.sizeUnit}px ${({ theme }) => theme.sizeUnit * 1.5}px;
  border: 1px solid ${({ theme }) => theme.colorBorder};
  border-radius: ${({ theme }) => theme.borderRadius}px;
  cursor: pointer;
  transition: border-color ${({ theme }) => theme.motionDurationMid};

  &:hover,
  &:focus-visible {
    border-color: ${({ theme }) => theme.colorPrimary};
  }
`;

const EllipsisText = styled(Typography.Text)`
  min-width: 0;
  flex: 1;
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
    // When there is no active query editor tab, create a new one with the
    // selected database + schema so the Redux state is initialised correctly.
    if (!queryEditorId && modalDb) {
      dispatch(
        addQueryEditor({
          dbId: modalDb.id,
          catalog: modalCatalog?.value,
          schema: modalSchema?.value,
          sql: 'SELECT ...',
        }),
      );
      setSelectorModalOpen(false);
      return;
    }

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
    queryEditorId,
    dispatch,
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

  const popoverContent = (
    <Flex
      vertical
      gap="middle"
      data-test="DatabaseSelector"
      style={{ minWidth: 500 }}
    >
      <Typography.Title level={5} style={{ margin: 0 }}>
        {t('Select Database and Schema')}
      </Typography.Title>
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
      <Flex justify="flex-end" gap="small">
        <Button
          buttonStyle="tertiary"
          onClick={e => {
            e?.stopPropagation();
            closeSelectorModal();
          }}
        >
          {t('Cancel')}
        </Button>
        <Button
          type="primary"
          onClick={e => {
            e?.stopPropagation();
            handleModalOk();
          }}
        >
          {t('Select')}
        </Button>
      </Flex>
    </Flex>
  );

  return (
    <LeftBarStyles data-test="sql-editor-left-bar">
      <Popover
        content={popoverContent}
        open={selectorModalOpen}
        onOpenChange={open => !open && closeSelectorModal()}
        placement="bottomLeft"
        trigger="click"
      >
        {/* Display-only sidebar header reading directly from Redux via
            useDatabaseSelector. Using DatabaseSelector here with sqlLabMode
            caused its internal hooks (useSchemas, useCatalogs) to fire and
            clear the selected schema before it could render. */}
        <SelectorTrigger
          data-test="DatabaseSelector"
          onClick={openSelectorModal}
          role="button"
          tabIndex={0}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              openSelectorModal();
            }
          }}
        >
          {db ? (
            <EllipsisText ellipsis>
              <Label>{db.backend || ''}</Label> {db.database_name}
            </EllipsisText>
          ) : (
            <EllipsisText ellipsis type="secondary">
              {t('Select database or type to search databases')}
            </EllipsisText>
          )}
          <Icons.RightOutlined />
          <EllipsisText ellipsis type={schema ? undefined : 'secondary'}>
            {schema || t('Select schema or type to search schemas')}
          </EllipsisText>
        </SelectorTrigger>
      </Popover>
      <Divider style={{ margin: 0 }} />
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

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
import {
  Button,
  EmptyState,
  Flex,
  Popover,
  Typography,
} from '@superset-ui/core/components';
import { t } from '@apache-superset/core/translation';
import { css } from '@apache-superset/core/theme';
import type { SchemaOption, CatalogOption } from 'src/hooks/apiResources';
import { DatabaseSelector, type DatabaseObject } from 'src/components';
import useDatabaseSelector from '../SqlEditorTopBar/useDatabaseSelector';

export interface DatabaseSelectorPopoverProps {
  queryEditorId: string;
  /** Renders the icon-only trigger used in the top bar when the sidebar is hidden. */
  compact?: boolean;
}

const DatabaseSelectorPopover = ({
  queryEditorId,
  compact = false,
}: DatabaseSelectorPopoverProps) => {
  const dbSelectorProps = useDatabaseSelector(queryEditorId);
  const { db, catalog, schema, onDbChange, onCatalogChange, onSchemaChange } =
    dbSelectorProps;

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

  const popoverContent = (
    <Flex
      vertical
      gap="middle"
      data-test="DatabaseSelector"
      css={css`
        min-width: 500px;
        max-width: 500px;
      `}
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
        filterBySqlLab
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
    <Popover
      content={popoverContent}
      open={selectorModalOpen}
      onOpenChange={open => !open && closeSelectorModal()}
      placement="bottomLeft"
      trigger="click"
    >
      {/* Wrap in a span so the Popover can attach a ref without relying
            on findDOMNode (deprecated in React 18+). */}
      <span>
        <DatabaseSelector
          key={`db-selector-${db ? db.id : 'no-db'}:${catalog ?? 'no-catalog'}:${
            schema ?? 'no-schema'
          }`}
          {...dbSelectorProps}
          emptyState={<EmptyState />}
          sqlLabMode
          compactMode={compact}
          onOpenModal={openSelectorModal}
        />
      </span>
    </Popover>
  );
};

export default DatabaseSelectorPopover;

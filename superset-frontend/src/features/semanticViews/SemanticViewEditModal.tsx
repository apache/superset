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
import { useState, useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from 'src/views/store';
import { confirmReload, markUnconfirmed } from './metadataSyncState';
import { t } from '@apache-superset/core/translation';
import { SupersetClient, getClientErrorObject } from '@superset-ui/core';
import { Button, Input, InputNumber } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import Tabs from '@superset-ui/core/components/Tabs';
import CacheMetadata from './CacheMetadata';
import { metadataSyncError } from './metadataSyncError';
import {
  Table,
  type ColumnsType,
  TableSize,
} from '@superset-ui/core/components/Table';
import { Alert } from '@apache-superset/core/components';
import { styled } from '@apache-superset/core/theme';
import {
  StandardModal,
  ModalFormField,
  MODAL_LARGE_WIDTH,
} from 'src/components/Modal';

const ModalContent = styled.div`
  padding: ${({ theme }) => theme.sizeUnit * 4}px;
`;

type InputNumberValue = number | null;

interface SemanticDimension {
  name: string;
  type: string;
  definition: string | null;
  description: string | null;
  grain: string | null;
}

interface SemanticMetric {
  name: string;
  type: string;
  definition: string;
  description: string | null;
}

interface SemanticViewStructure {
  uuid?: string;
  can_refresh_metadata?: boolean;
  // Optional because an older backend may not emit them (deploy skew); the
  // hydration effect only overwrites the form when they are present.
  description?: string | null;
  cache_timeout?: number | null;
  dimensions: SemanticDimension[];
  metrics: SemanticMetric[];
}

interface SemanticViewEditModalProps {
  show: boolean;
  onHide: () => void;
  onSave: () => void;
  onMetadataSync?: (isCurrent: () => boolean) => void | Promise<void>;
  addDangerToast?: (msg: string) => void;
  addSuccessToast?: (msg: string) => void;
  semanticView: {
    id: number;
    table_name: string;
    description?: string | null;
    cache_timeout?: number | null;
  } | null;
}

const DIMENSION_COLUMNS: ColumnsType<SemanticDimension> = [
  { title: t('Name'), dataIndex: 'name', key: 'name' },
  { title: t('Type'), dataIndex: 'type', key: 'type' },
  { title: t('Grain'), dataIndex: 'grain', key: 'grain' },
  { title: t('Description'), dataIndex: 'description', key: 'description' },
  { title: t('Expression'), dataIndex: 'definition', key: 'definition' },
];

const METRIC_COLUMNS: ColumnsType<SemanticMetric> = [
  { title: t('Name'), dataIndex: 'name', key: 'name' },
  { title: t('Type'), dataIndex: 'type', key: 'type' },
  { title: t('Description'), dataIndex: 'description', key: 'description' },
  { title: t('Definition'), dataIndex: 'definition', key: 'definition' },
];

// Structure tables are read-only; small catalogs render in full, but a
// large semantic layer can expose hundreds of rows, so switch to
// pagination past this threshold instead of rendering unboundedly.
const STRUCTURE_PAGINATION_THRESHOLD = 100;

const STRUCTURE_INFO_MESSAGE = t(
  'Structure is managed by the upstream semantic layer and is read-only.',
);

type SyncState =
  | { status: 'idle' | 'syncing' }
  | { status: 'reloading' | 'done' | 'reload-error'; changed: boolean | null }
  | { status: 'error' | 'indeterminate'; message: string };

export default function SemanticViewEditModal({
  show,
  onHide,
  onSave,
  onMetadataSync,
  addDangerToast,
  addSuccessToast,
  semanticView,
}: SemanticViewEditModalProps) {
  const [description, setDescription] = useState<string>('');
  const [cacheTimeout, setCacheTimeout] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [structure, setStructure] = useState<SemanticViewStructure | null>(
    null,
  );
  const [structureLoading, setStructureLoading] = useState(false);
  const [localSyncState, setSyncState] = useState<SyncState>({
    status: 'idle',
  });
  const dispatch = useAppDispatch();
  const unconfirmedMessage = useAppSelector(state =>
    structure?.uuid ? state.semanticMetadataSync?.[structure.uuid] : undefined,
  );
  const syncState: SyncState =
    unconfirmedMessage &&
    localSyncState.status !== 'syncing' &&
    localSyncState.status !== 'reloading' &&
    localSyncState.status !== 'reload-error'
      ? { status: 'indeterminate', message: unconfirmedMessage }
      : localSyncState;
  const [activeTab, setActiveTab] = useState('details');
  const generation = useRef(0);
  const busy = useRef(false);
  const syncing =
    syncState.status === 'syncing' || syncState.status === 'reloading';
  const reloadOnly =
    syncState.status === 'reload-error' || syncState.status === 'indeterminate';

  useEffect(() => {
    generation.current += 1;
    const requestGeneration = generation.current;
    const isCurrent = () => requestGeneration === generation.current;
    busy.current = false;
    setSaving(false);
    setSyncState({ status: 'idle' });
    setActiveTab('details');
    setStructure(null);
    setStructureLoading(false);
    if (!show || !semanticView) return undefined;

    // Only initial hydration touches the draft. Sync reloads structure alone.
    setDescription(semanticView.description || '');
    setCacheTimeout(semanticView.cache_timeout ?? null);
    setStructureLoading(true);
    SupersetClient.get({
      endpoint: `/api/v1/semantic_view/${semanticView.id}/structure`,
    })
      .then(({ json }) => {
        if (!isCurrent()) return;
        setStructure(json.result);
        if ('description' in json.result)
          setDescription(json.result.description || '');
        if ('cache_timeout' in json.result)
          setCacheTimeout(json.result.cache_timeout ?? null);
      })
      .catch(async error => {
        if (!isCurrent()) return;
        const clientError = await getClientErrorObject(error);
        if (!isCurrent()) return;
        addDangerToast?.(
          clientError.message ||
            clientError.error ||
            t('An error occurred while fetching the semantic view structure'),
        );
      })
      .finally(() => {
        if (isCurrent()) setStructureLoading(false);
      });
    return () => {
      generation.current += 1;
    };
  }, [show, semanticView?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleHide = () => {
    generation.current += 1;
    busy.current = false;
    onHide();
  };

  const handleSave = async () => {
    if (!semanticView || busy.current || structureLoading) return;
    busy.current = true;
    generation.current += 1;
    const requestGeneration = generation.current;
    const isCurrent = () => requestGeneration === generation.current;
    setSaving(true);
    try {
      await SupersetClient.put({
        endpoint: `/api/v1/semantic_view/${semanticView.id}`,
        jsonPayload: {
          description: description || null,
          cache_timeout: cacheTimeout,
        },
      });
      addSuccessToast?.(t('Semantic view updated'));
      if (isCurrent()) {
        onSave();
        handleHide();
      }
    } catch (error) {
      const clientError = await getClientErrorObject(error);
      addDangerToast?.(
        clientError.error ||
          t('An error occurred while saving the semantic view'),
      );
    } finally {
      if (isCurrent()) {
        busy.current = false;
        setSaving(false);
      }
    }
  };

  const reloadFields = async (
    viewId: number,
    changed: boolean | null,
    isCurrent: () => boolean,
  ) => {
    setSyncState({ status: 'reloading', changed });
    try {
      const { json } = await SupersetClient.get({
        endpoint: `/api/v1/semantic_view/${viewId}/structure`,
      });
      if (!isCurrent()) return;
      setStructure(json.result);
      await onMetadataSync?.(isCurrent);
      if (!isCurrent()) return;
      if (structure?.uuid) dispatch(confirmReload(structure.uuid));
      setSyncState({ status: 'done', changed });
    } catch {
      if (isCurrent()) setSyncState({ status: 'reload-error', changed });
    }
  };

  const handleSync = async () => {
    if (
      !semanticView ||
      !structure?.uuid ||
      structure.can_refresh_metadata !== true ||
      busy.current ||
      reloadOnly
    )
      return;
    busy.current = true;
    generation.current += 1;
    const requestGeneration = generation.current;
    const isCurrent = () => requestGeneration === generation.current;
    setSyncState({ status: 'syncing' });
    try {
      const { json } = await SupersetClient.post({
        endpoint: `/api/v1/semantic_view/${structure.uuid}/refresh_metadata/`,
        jsonPayload: {},
      });
      if (!isCurrent()) return;
      await reloadFields(
        semanticView.id,
        json.result.status === 'changed',
        isCurrent,
      );
    } catch (error) {
      const { message, reloadRequired } = await metadataSyncError(error);
      if (reloadRequired)
        dispatch(markUnconfirmed({ uuid: structure.uuid, message }));
      if (!isCurrent()) return;
      setSyncState({
        status: reloadRequired ? 'indeterminate' : 'error',
        message,
      });
    } finally {
      if (isCurrent()) busy.current = false;
    }
  };

  const handleReload = async () => {
    if (
      !semanticView ||
      busy.current ||
      (syncState.status !== 'reload-error' &&
        syncState.status !== 'indeterminate')
    )
      return;
    busy.current = true;
    generation.current += 1;
    const requestGeneration = generation.current;
    const isCurrent = () => requestGeneration === generation.current;
    try {
      await reloadFields(
        semanticView.id,
        syncState.status === 'reload-error' ? syncState.changed : null,
        isCurrent,
      );
    } finally {
      if (isCurrent()) busy.current = false;
    }
  };

  const dimensions = structure?.dimensions ?? [];
  const metrics = structure?.metrics ?? [];

  return (
    <StandardModal
      show={show}
      onHide={handleHide}
      onSave={handleSave}
      title={t('Edit %s', semanticView?.table_name || '')}
      icon={<Icons.EditOutlined />}
      isEditMode
      width={MODAL_LARGE_WIDTH}
      saveLoading={saving}
      saveDisabled={syncing}
      contentLoading={structureLoading}
    >
      <ModalContent>
        {syncing && <output>{t('Syncing metadata…')}</output>}
        {syncState.status === 'done' && (
          <output>
            {syncState.changed === null
              ? t('Fields reloaded')
              : syncState.changed
                ? t('Metadata synced')
                : t('Metadata is up to date')}
          </output>
        )}
        {(syncState.status === 'error' ||
          syncState.status === 'indeterminate') && (
          <Alert
            type={syncState.status === 'indeterminate' ? 'warning' : 'error'}
            role="alert"
            message={syncState.message}
            action={
              syncState.status === 'indeterminate' ? (
                <Button buttonSize="small" onClick={handleReload}>
                  {t('Reload fields')}
                </Button>
              ) : undefined
            }
            showIcon
          />
        )}
        {syncState.status === 'reload-error' && (
          <Alert
            type="warning"
            closable={false}
            role="alert"
            message={
              syncState.changed === null
                ? t('Unable to reload fields')
                : t('Metadata synced; unable to reload fields')
            }
            action={
              <Button buttonSize="small" onClick={handleReload}>
                {t('Reload fields')}
              </Button>
            }
            showIcon
          />
        )}
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          tabBarExtraContent={
            structure?.uuid && structure.can_refresh_metadata === true ? (
              <Button
                aria-label={t('Sync metadata')}
                buttonSize="small"
                buttonStyle="tertiary"
                onClick={handleSync}
                disabled={saving || syncing || reloadOnly}
                loading={syncing}
              >
                <Icons.DatabaseOutlined iconSize="m" aria-hidden />
                {t('Sync metadata')}
              </Button>
            ) : undefined
          }
        >
          <Tabs.TabPane tab={t('Details')} key="details">
            <ModalFormField label={t('Description')}>
              <Input.TextArea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={4}
              />
            </ModalFormField>
            <ModalFormField label={t('Cache timeout')}>
              <InputNumber
                value={cacheTimeout}
                onChange={value => setCacheTimeout(value as InputNumberValue)}
                min={0}
                placeholder={t('Duration in seconds')}
                style={{ width: '100%' }}
              />
            </ModalFormField>
          </Tabs.TabPane>
          <Tabs.TabPane
            tab={t('Dimensions (%s)', dimensions.length)}
            key="dimensions"
          >
            <Alert
              type="info"
              message={STRUCTURE_INFO_MESSAGE}
              showIcon
              css={{ marginBottom: 16 }}
            />
            <Table<SemanticDimension>
              data={dimensions}
              columns={DIMENSION_COLUMNS}
              size={TableSize.Small}
              rowKey="name"
              usePagination={dimensions.length > STRUCTURE_PAGINATION_THRESHOLD}
              defaultPageSize={STRUCTURE_PAGINATION_THRESHOLD}
            />
          </Tabs.TabPane>
          <Tabs.TabPane tab={t('Metrics (%s)', metrics.length)} key="metrics">
            <Alert
              type="info"
              message={STRUCTURE_INFO_MESSAGE}
              showIcon
              css={{ marginBottom: 16 }}
            />
            <Table<SemanticMetric>
              data={metrics}
              columns={METRIC_COLUMNS}
              size={TableSize.Small}
              rowKey="name"
              usePagination={metrics.length > STRUCTURE_PAGINATION_THRESHOLD}
              defaultPageSize={STRUCTURE_PAGINATION_THRESHOLD}
            />
          </Tabs.TabPane>
          {structure?.uuid && structure.can_refresh_metadata === true && (
            <Tabs.TabPane tab={t('Cache metadata')} key="cache-metadata">
              {show && !syncing && !saving && (
                <CacheMetadata key={structure.uuid} viewUuid={structure.uuid} />
              )}
            </Tabs.TabPane>
          )}
        </Tabs>
      </ModalContent>
    </StandardModal>
  );
}

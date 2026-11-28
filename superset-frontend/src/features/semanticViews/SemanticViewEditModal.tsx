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
import { useState, useEffect } from 'react';
import { t } from '@apache-superset/core/translation';
import { SupersetClient, getClientErrorObject } from '@superset-ui/core';
import { Button, Input, InputNumber } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import Tabs from '@superset-ui/core/components/Tabs';
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

import AddSemanticViewModal, {
  ExistingSemanticView,
} from './AddSemanticViewModal';

const ModalContent = styled.div`
  padding: ${({ theme }) => theme.sizeUnit * 4}px;
`;

type InputNumberValue = number | null;

interface SemanticDimension {
  name: string;
  type: string;
  definition: string | null;
  description: string | null;
  grains: string[];
  allows_default_grain: boolean;
  omitted_grain: string;
  ungrained_filter: string;
}

interface SemanticMetric {
  name: string;
  type: string;
  definition: string;
  description: string | null;
}

interface SemanticViewStructure {
  // Optional because an older backend may not emit them (deploy skew); the
  // hydration effect only overwrites the form when they are present.
  description?: string | null;
  cache_timeout?: number | null;
  time_grains?: { duration: string; name: string }[];
  dimensions: SemanticDimension[];
  metrics: SemanticMetric[];
}

interface SemanticViewEditModalProps {
  show: boolean;
  onHide: () => void;
  onSave: () => void;
  addDangerToast?: (msg: string) => void;
  addSuccessToast?: (msg: string) => void;
  semanticView: {
    id: number;
    table_name: string;
    description?: string | null;
    cache_timeout?: number | null;
  } | null;
}

const dimensionColumns = (
  timeGrains: { duration: string; name: string }[],
): ColumnsType<SemanticDimension> => [
  { title: t('Name'), dataIndex: 'name', key: 'name' },
  { title: t('Type'), dataIndex: 'type', key: 'type' },
  {
    title: t('Supported grains'),
    dataIndex: 'grains',
    key: 'grains',
    render: (grains: string[]) =>
      [
        ...timeGrains
          .filter(grain => grains.includes(grain.duration))
          .map(grain => grain.name),
        ...grains.filter(
          duration => !timeGrains.some(grain => grain.duration === duration),
        ),
      ].join(', '),
  },
  {
    title: t('Native grain'),
    dataIndex: 'allows_default_grain',
    key: 'allows_default_grain',
    render: (allowed: boolean) =>
      allowed ? t('Native allowed') : t('Explicit grain required'),
  },
  {
    title: t('Omitted grain'),
    dataIndex: 'omitted_grain',
    key: 'omitted_grain',
    render: (selector: string) =>
      selector === 'native'
        ? t('Native')
        : selector === 'reject'
          ? t('Explicit grain required')
          : (timeGrains.find(grain => grain.duration === selector)?.name ??
            selector),
  },
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

export default function SemanticViewEditModal({
  show,
  onHide,
  onSave,
  addDangerToast,
  addSuccessToast,
  semanticView,
}: SemanticViewEditModalProps) {
  const [recovery, setRecovery] = useState<ExistingSemanticView | null>(null);
  const [reselecting, setReselecting] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState('');
  const [description, setDescription] = useState<string>('');
  const [cacheTimeout, setCacheTimeout] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [structure, setStructure] = useState<SemanticViewStructure | null>(
    null,
  );
  const [structureLoading, setStructureLoading] = useState(false);

  // Seeds the form from the caller's copy — what the form falls back to if
  // /structure fails (a spinner covers the form while that fetch is in
  // flight). Keyed to open/identity rather than the semanticView object so a
  // parent re-render cannot clobber in-progress edits.
  useEffect(() => {
    if (semanticView) {
      setDescription(semanticView.description || '');
      setCacheTimeout(semanticView.cache_timeout ?? null);
    }
  }, [show, semanticView?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!show || !semanticView) {
      setStructure(null);
      setStructureLoading(false);
      return undefined;
    }

    let cancelled = false;
    setRecovery(null);
    setReselecting(false);
    setRecoveryMessage('');
    setStructureLoading(true);
    SupersetClient.get({
      endpoint: `/api/v1/semantic_view/${semanticView.id}/structure`,
    })
      .then(({ json }) => {
        if (cancelled) return;
        setStructure(json.result);
        // The caller's copy of these fields goes stale the moment this modal
        // saves, so re-open hydrates from the server rather than the prop.
        // Only overwrite when the response carries the field: an older
        // backend that omits it (deploy skew) must not blank the form — while
        // an explicit null still means "cleared on the server".
        if ('description' in json.result) {
          setDescription(json.result.description || '');
        }
        if ('cache_timeout' in json.result) {
          setCacheTimeout(json.result.cache_timeout ?? null);
        }
      })
      .catch(async error => {
        if (cancelled) return;
        if (typeof error?.clone === 'function') {
          const body: unknown = await error
            .clone()
            .json()
            .catch(() => null);
          if (cancelled) return;
          if (
            body !== null &&
            typeof body === 'object' &&
            'error_type' in body &&
            body.error_type === 'SemanticViewConfigurationError' &&
            'message' in body &&
            typeof body.message === 'string' &&
            'recovery' in body &&
            body.recovery !== null &&
            typeof body.recovery === 'object' &&
            'id' in body.recovery &&
            'name' in body.recovery &&
            'semantic_layer_uuid' in body.recovery &&
            typeof body.recovery?.id === 'number' &&
            typeof body.recovery?.name === 'string' &&
            typeof body.recovery?.semantic_layer_uuid === 'string'
          ) {
            setRecovery({
              id: body.recovery.id,
              name: body.recovery.name,
              semantic_layer_uuid: body.recovery.semantic_layer_uuid,
            });
            setRecoveryMessage(body.message);
            return;
          }
        }
        const clientError = await getClientErrorObject(error);
        if (cancelled) return;
        addDangerToast?.(
          clientError.error ||
            t('An error occurred while fetching the semantic view structure'),
        );
      })
      .finally(() => {
        if (!cancelled) setStructureLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [show, semanticView?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async () => {
    if (!semanticView) return;
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
      onSave();
      onHide();
    } catch (error) {
      const clientError = await getClientErrorObject(error);
      addDangerToast?.(
        clientError.error ||
          t('An error occurred while saving the semantic view'),
      );
    } finally {
      setSaving(false);
    }
  };

  const dimensions = structure?.dimensions ?? [];
  const metrics = structure?.metrics ?? [];

  if (reselecting && recovery) {
    return (
      <AddSemanticViewModal
        show={show}
        existingView={recovery}
        onHide={() => setReselecting(false)}
        onSuccess={() => {
          onSave();
          onHide();
        }}
        addDangerToast={addDangerToast ?? (() => {})}
        addSuccessToast={addSuccessToast ?? (() => {})}
      />
    );
  }

  return (
    <StandardModal
      show={show}
      onHide={onHide}
      onSave={handleSave}
      title={t('Edit %s', semanticView?.table_name || '')}
      icon={<Icons.EditOutlined />}
      isEditMode
      width={MODAL_LARGE_WIDTH}
      saveLoading={saving}
      saveDisabled={Boolean(recovery)}
      contentLoading={structureLoading}
    >
      <ModalContent>
        {recovery && (
          <Alert
            type="warning"
            message={recoveryMessage}
            description={
              <Button onClick={() => setReselecting(true)}>
                {t('Re-select fields')}
              </Button>
            }
            showIcon
          />
        )}
        <Tabs>
          <Tabs.TabPane tab={t('Details')} key="details">
            <ModalFormField label={t('Description')}>
              <Input.TextArea
                aria-label={t('Description')}
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
              columns={dimensionColumns(structure?.time_grains ?? [])}
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
        </Tabs>
      </ModalContent>
    </StandardModal>
  );
}

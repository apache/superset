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

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { t, SupersetClient } from '@superset-ui/core';
import { styled, css } from '@apache-superset/core/ui';
import { DeleteModal, Tooltip } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import withToasts from 'src/components/MessageToasts/withToasts';
import { ListView } from 'src/components';
import SubMenu, { SubMenuProps } from 'src/features/home/SubMenu';

const PAGE_SIZE = 25;

interface EmbeddedChart {
  uuid: string;
  chart_id: number;
  chart_name: string | null;
  allowed_domains: string[];
  changed_on: string | null;
}

interface EmbeddedChartsListProps {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
}

const ActionsWrapper = styled.div`
  display: flex;
  gap: 8px;
`;

const ActionButton = styled.button`
  ${({ theme }) => css`
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px;
    color: ${theme.colorTextSecondary};
    &:hover {
      color: ${theme.colorPrimary};
    }
  `}
`;

function EmbeddedChartsList({
  addDangerToast,
  addSuccessToast,
}: EmbeddedChartsListProps) {
  const [embeddedCharts, setEmbeddedCharts] = useState<EmbeddedChart[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartToDelete, setChartToDelete] = useState<EmbeddedChart | null>(
    null,
  );

  const fetchEmbeddedCharts = useCallback(async () => {
    setLoading(true);
    try {
      const response = await SupersetClient.get({
        endpoint: '/api/v1/chart/embedded',
      });
      setEmbeddedCharts(response.json.result || []);
    } catch (error) {
      addDangerToast(t('Error loading embedded charts'));
    } finally {
      setLoading(false);
    }
  }, [addDangerToast]);

  useEffect(() => {
    fetchEmbeddedCharts();
  }, [fetchEmbeddedCharts]);

  const handleDelete = useCallback(
    async (chart: EmbeddedChart) => {
      try {
        await SupersetClient.delete({
          endpoint: `/api/v1/chart/${chart.chart_id}/embedded`,
        });
        addSuccessToast(t('Embedding disabled for %s', chart.chart_name));
        fetchEmbeddedCharts();
      } catch (error) {
        addDangerToast(
          t('Error disabling embedding for %s', chart.chart_name),
        );
      } finally {
        setChartToDelete(null);
      }
    },
    [addDangerToast, addSuccessToast, fetchEmbeddedCharts],
  );

  const copyToClipboard = useCallback(
    (text: string) => {
      navigator.clipboard.writeText(text).then(
        () => addSuccessToast(t('UUID copied to clipboard')),
        () => addDangerToast(t('Failed to copy to clipboard')),
      );
    },
    [addDangerToast, addSuccessToast],
  );

  const columns = useMemo(
    () => [
      {
        accessor: 'chart_name',
        Header: t('Chart'),
        Cell: ({
          row: {
            original: { chart_id, chart_name },
          },
        }: {
          row: { original: EmbeddedChart };
        }) => (
          <Link to={`/explore/?slice_id=${chart_id}`}>
            {chart_name || t('Untitled')}
          </Link>
        ),
      },
      {
        accessor: 'uuid',
        Header: t('UUID'),
        Cell: ({
          row: {
            original: { uuid },
          },
        }: {
          row: { original: EmbeddedChart };
        }) => (
          <Tooltip title={t('Click to copy')}>
            <code
              style={{ cursor: 'pointer' }}
              onClick={() => copyToClipboard(uuid)}
              role="button"
              tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && copyToClipboard(uuid)}
            >
              {uuid.substring(0, 8)}...
            </code>
          </Tooltip>
        ),
      },
      {
        accessor: 'allowed_domains',
        Header: t('Allowed Domains'),
        Cell: ({
          row: {
            original: { allowed_domains },
          },
        }: {
          row: { original: EmbeddedChart };
        }) =>
          allowed_domains.length > 0 ? allowed_domains.join(', ') : t('Any'),
      },
      {
        accessor: 'changed_on',
        Header: t('Last Modified'),
        Cell: ({
          row: {
            original: { changed_on },
          },
        }: {
          row: { original: EmbeddedChart };
        }) =>
          changed_on ? new Date(changed_on).toLocaleDateString() : t('N/A'),
      },
      {
        accessor: 'actions',
        Header: t('Actions'),
        disableSortBy: true,
        Cell: ({
          row: { original },
        }: {
          row: { original: EmbeddedChart };
        }) => (
          <ActionsWrapper>
            <Tooltip title={t('Copy UUID')}>
              <ActionButton onClick={() => copyToClipboard(original.uuid)}>
                <Icons.CopyOutlined iconSize="m" />
              </ActionButton>
            </Tooltip>
            <Tooltip title={t('View Chart')}>
              <Link to={`/explore/?slice_id=${original.chart_id}`}>
                <ActionButton as="span">
                  <Icons.EyeOutlined iconSize="m" />
                </ActionButton>
              </Link>
            </Tooltip>
            <Tooltip title={t('Disable Embedding')}>
              <ActionButton onClick={() => setChartToDelete(original)}>
                <Icons.DeleteOutlined iconSize="m" />
              </ActionButton>
            </Tooltip>
          </ActionsWrapper>
        ),
      },
    ],
    [copyToClipboard],
  );

  const subMenuButtons: SubMenuProps['buttons'] = [];

  return (
    <>
      <SubMenu name={t('Embedded Charts')} buttons={subMenuButtons} />
      <ListView<EmbeddedChart>
        className="embedded-charts-list-view"
        columns={columns}
        data={embeddedCharts}
        count={embeddedCharts.length}
        pageSize={PAGE_SIZE}
        loading={loading}
        initialSort={[{ id: 'chart_name', desc: false }]}
        fetchData={() => {}}
        refreshData={fetchEmbeddedCharts}
        addDangerToast={addDangerToast}
        addSuccessToast={addSuccessToast}
        bulkSelectEnabled={false}
        disableBulkSelect={() => {}}
        bulkActions={[]}
      />
      {chartToDelete && (
        <DeleteModal
          description={t(
            'This will disable embedding for the chart "%s". The embed UUID will no longer work.',
            chartToDelete.chart_name || t('Untitled'),
          )}
          onConfirm={() => handleDelete(chartToDelete)}
          onHide={() => setChartToDelete(null)}
          open
          title={t('Disable Embedding?')}
        />
      )}
    </>
  );
}

export default withToasts(EmbeddedChartsList);

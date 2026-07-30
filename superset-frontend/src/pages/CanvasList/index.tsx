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

import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { t } from '@apache-superset/core/translation';
import withToasts from 'src/components/MessageToasts/withToasts';
import SubMenu from 'src/features/home/SubMenu';
import { useListViewResource } from 'src/views/CRUD/hooks';
import {
  ListView,
  ListViewFilterOperator as FilterOperator,
  type ListViewFilters,
} from 'src/components';

const PAGE_SIZE = 25;

interface CanvasObject {
  id: number;
  name: string;
  changed_on_delta_humanized?: string;
  created_by?: { first_name: string; last_name: string };
}

interface CanvasListProps {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
}

function CanvasList({ addDangerToast, addSuccessToast }: CanvasListProps) {
  const {
    state: {
      loading,
      resourceCount: canvasCount,
      resourceCollection: canvases,
    },
    fetchData,
    refreshData,
  } = useListViewResource<CanvasObject>(
    'canvas',
    t('Canvases'),
    addDangerToast,
  );

  const columns = useMemo(
    () => [
      {
        accessor: 'name',
        Header: t('Name'),
        Cell: ({ row: { original } }: { row: { original: CanvasObject } }) => (
          <Link to={`/canvas/${original.id}/`}>{original.name}</Link>
        ),
      },
      {
        accessor: 'created_by',
        Header: t('Created by'),
        disableSortBy: true,
        Cell: ({ row: { original } }: { row: { original: CanvasObject } }) =>
          original.created_by
            ? `${original.created_by.first_name} ${original.created_by.last_name}`
            : '',
      },
      {
        accessor: 'changed_on_delta_humanized',
        Header: t('Last modified'),
      },
    ],
    [],
  );

  const filters: ListViewFilters = useMemo(
    () => [
      {
        Header: t('Name'),
        key: 'search',
        id: 'name',
        input: 'search',
        operator: FilterOperator.Contains,
      },
    ],
    [],
  );

  return (
    <>
      <SubMenu name={t('Canvases')} />
      <ListView<CanvasObject>
        className="canvas-list-view"
        columns={columns}
        count={canvasCount}
        data={canvases}
        fetchData={fetchData}
        refreshData={refreshData}
        filters={filters}
        initialSort={[{ id: 'changed_on_delta_humanized', desc: true }]}
        loading={loading}
        pageSize={PAGE_SIZE}
        addDangerToast={addDangerToast}
        addSuccessToast={addSuccessToast}
      />
    </>
  );
}

export default withToasts(CanvasList);

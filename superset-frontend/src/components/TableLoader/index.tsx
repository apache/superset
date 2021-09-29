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
import React, { useState, useEffect, useMemo } from 'react';
import { t, SupersetClient, JsonObject } from '@superset-ui/core';
import TableView, { EmptyWrapperType } from 'src/components/TableView';
import withToasts from 'src/components/MessageToasts/withToasts';
import Loading from 'src/components/Loading';
import 'stylesheets/reactable-pagination.less';

export interface TableLoaderProps {
  dataEndpoint?: string;
  mutator?: (data: JsonObject) => any[];
  columns?: string[];
  addDangerToast(text: string): any;
}

const TableLoader = (props: TableLoaderProps) => {
  const [data, setData] = useState<Array<any>>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const { dataEndpoint, mutator } = props;
    if (dataEndpoint) {
      SupersetClient.get({ endpoint: dataEndpoint })
        .then(({ json }) => {
          const data = (mutator ? mutator(json) : json) as Array<any>;
          setData(data);
          setIsLoading(false);
        })
        .catch(() => {
          setIsLoading(false);
          props.addDangerToast(t('An error occurred'));
        });
    }
  }, [props]);

  const { columns, ...tableProps } = props;

  const memoizedColumns = useMemo(() => {
    let tableColumns = columns;
    if (!columns && data.length > 0) {
      tableColumns = Object.keys(data[0]).filter(col => col[0] !== '_');
    }
    return tableColumns
      ? tableColumns.map((column: string) => ({
          accessor: column,
          Header: column,
        }))
      : [];
  }, [columns, data]);

  delete tableProps.dataEndpoint;
  delete tableProps.mutator;

  if (isLoading) {
    return <Loading />;
  }

  return (
    <TableView
      columns={memoizedColumns}
      data={data}
      pageSize={50}
      loading={isLoading}
      emptyWrapperType={EmptyWrapperType.Small}
      {...tableProps}
    />
  );
};

export default withToasts(TableLoader);

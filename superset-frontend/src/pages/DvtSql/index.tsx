import React, { useEffect, useState } from 'react';
import { t } from '@superset-ui/core';
import DvtPagination from 'src/components/DvtPagination';
import DvtTable from 'src/components/DvtTable';
import { useAppSelector } from 'src/hooks/useAppSelector';
import { StyledSqlPagination } from './dvt-sql.module';


const SavedQueriesHeader = [
  { id: 1, title: t('Name'), field: 'label', flex: 3 },
  { id: 2, title: t('Database'), field: 'database_name' },
  { id: 3, title: t('Schema'), field: 'schema' },
  { id: 4, title: t('Tables'), field: 'table' },
  { id: 5, title: t('Created on'), field: 'id' },
  { id: 6, title: t('Modified'), field: 'changed_on_delta_humanized' },
  {
    id: 7,
    title: t('Actions'),
    clicks: [
      {
        icon: 'edit_alt',
        click: () => {},
        popperLabel: t('Edit'),
      },
      {
        icon: 'share',
        click: () => {},
        popperLabel: t('Export'),
      },
      {
        icon: 'trash',
        click: () => {},
        popperLabel: t('Delete'),
      },
    ],
  },
];

const QueryHistoryHeader = [
  {
    id: 1,
    title: t('Time'),
    field: 'changed_on',
    flex: 3,
  },
  {
    id: 2,
    title: t('Tab Name'),
    field: 'tab_name',
  },
  {
    id: 3,
    title: t('Database'),
    field: 'database_name',
  },
  {
    id: 4,
    title: t('Schema'),
    field: 'schema',
  },
  {
    id: 5,
    title: t('Tables'),
    field: 'table',
  },
  {
    id: 6,
    title: t('User'),
    field: 'user',
  },
  {
    id: 7,
    title: t('Rows'),
    field: 'rows',
  },
  {
    id: 8,
    title: t('SQL'),
    field: 'sql',
  },
  {
    id: 9,
    title: t('Actions'),
    clicks: [
      {
        icon: 'edit_alt',
        click: () => {},
        popperLabel: t('Edit'),
      },
    ],
  },
];

function DvtSql() {
  const [data, setData] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [count, setCount] = useState<number>(0);
  const sqlSelector = useAppSelector(state => state.dvtNavbar.sql);

  const [tabsAndPage, setTabsAndPage] = useState({
    tab: sqlSelector.tabs,
    page: 1,
  });

  useEffect(() => {
    setTabsAndPage({ tab: sqlSelector.tabs, page: 1 });
    setCurrentPage(1);
  }, [sqlSelector.tabs]);

  useEffect(() => {
    setTabsAndPage(state => ({ ...state, page: currentPage }));
  }, [currentPage]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(
          tabsAndPage.tab === 'Query History'
            ? `/api/v1/query/?q=(order_column:start_time,order_direction:desc,page:${
                tabsAndPage.page - 1
              },page_size:10)`
            : `/api/v1/saved_query/?q=(order_column:changed_on_delta_humanized,order_direction:desc,page:${
                tabsAndPage.page - 1
              },page_size:10)`,
        );
        const rawData = await response.json();

        const transformedData = rawData.result.map((item: any) => {
          if (tabsAndPage.tab === 'Query History') {
            return {
              id: item.id,
              changed_on: item.changed_on,
              tab_name: item.tab_name,
              database_name: item.database.database_name,
              schema: item.schema,
              table: item.sql_tables.table,
              user: `${item.user.first_name} ${item.user.last_name}`,
              rows: item.rows,
              sql: '',
            };
          }
          if (tabsAndPage.tab === 'Saved Queries') {
            return {
              id: item.id,
              database_name: item.database.database_name,
              schema: item.schema,
              table: item.sql_tables.table,
              created_on: item.created_on,
              modified: item.modified,
              user: `${item.created_by.first_name} ${item.created_by.last_name}`,
            };
          }
          return item;
        });

        setData(transformedData);
        setCount(rawData.count);
      } catch (error) {
        console.error('Error:', error);
      }
    };

    fetchData();
  }, [tabsAndPage.tab, tabsAndPage.page]);

  return (
    <div>
      <div>
        {sqlSelector.tabs === 'Query History' && (
          <DvtTable data={data} header={QueryHistoryHeader} />
        )}
        {sqlSelector.tabs === 'Saved Queries' && (
          <DvtTable data={data} header={SavedQueriesHeader} />
        )}
      </div>
      <StyledSqlPagination>
        <DvtPagination
          page={currentPage}
          setPage={setCurrentPage}
          itemSize={count}
          pageItemSize={10}
        />
      </StyledSqlPagination>
    </div>
  );
}

export default DvtSql;

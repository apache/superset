import type { FC } from 'react';
import { t } from '@superset-ui/core';
import { useSelector } from 'react-redux';
import withToasts from 'src/components/MessageToasts/withToasts';
import ListView from 'src/components/ListView';
import SubMenu from 'src/features/home/SubMenu';
import { useRequestList } from './useRequestList';
import type { RequestListType } from './types';
import { columns, initialSort } from './consts';
import { getRequestListData } from '../../model/selectors/getRequestListData';
import { getRequestListLoading } from '../../model/selectors/getRequestListLoading';

const PAGE_SIZE = 10;

interface RequestListProps {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
}

const RequestListPage: FC<RequestListProps> = ({
  addDangerToast,
  addSuccessToast,
}) => {
  const { fetchData, filters } = useRequestList();

  const data = useSelector(getRequestListData);
  const loading = useSelector(getRequestListLoading);

  return (
    <div>
      <SubMenu name={t('Requests')} buttons={[]} />
      <ListView<RequestListType>
        className="request-list-view"
        columns={columns}
        count={data?.count ?? 0}
        data={data?.rows ?? []}
        fetchData={fetchData}
        filters={filters}
        initialSort={initialSort}
        loading={loading}
        pageSize={PAGE_SIZE}
        defaultViewMode="table"
        addDangerToast={addDangerToast}
        addSuccessToast={addSuccessToast}
        refreshData={() => {}}
      />
    </div>
  );
};

export default withToasts(RequestListPage);

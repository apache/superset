import { useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useHistory } from 'react-router-dom';
import { t } from '@superset-ui/core';
import {
  FetchDataConfig,
  FilterOperator,
  Filters,
} from '../../../../components/ListView';
import { getUserInfo } from '../../model/selectors/getUserInfo';
import { loadRequestList } from '../../model/actions/loadRequestList';
import { useToasts } from '../../../../components/MessageToasts/withToasts';
import {
  createErrorHandler,
  createFetchRelated,
} from '../../../../views/CRUD/utils';

export const useRequestList = () => {
  const dispatch = useDispatch();
  const user = useSelector(getUserInfo);
  const history = useHistory();

  if (!user.roles.Admin) {
    history.push('/superset/welcome/');
  }

  const toasts = useToasts();

  const fetchData = useCallback(
    (config: FetchDataConfig) => {
      dispatch(loadRequestList(config));
    },
    [dispatch],
  );

  const filters: Filters = useMemo(
    () => [
      {
        id: 'id',
        Header: 'id',
        key: 'id',
        input: 'search',
        operator: 'eq_id_statement' as FilterOperator,
      },
      {
        id: 'user',
        Header: t('User'),
        key: 'user',
        input: 'select',
        operator: 'rel_m_m' as FilterOperator,
        unfilteredLabel: t('All'),
        fetchSelects: createFetchRelated(
          'statement',
          'user',
          createErrorHandler(errMsg =>
            toasts.addDangerToast(
              t(
                'An error occurred while fetching statements user values: %s',
                errMsg,
              ),
            ),
          ),
          // props.user,
        ),
        paginate: true,
      },
      // {
      //   id: 'user.email',
      //   Header: t('email'),
      //   key: 'email',
      //   input: 'search',
      //   operator: RequestFilterOperator.contains,
      // },
      {
        id: 'finished',
        Header: t('Closed'),
        key: 'isClosed',
        input: 'select',
        operator: FilterOperator.Equals,
        unfilteredLabel: t('Any'),
        selects: [
          { label: t('Yes'), value: true },
          { label: t('No'), value: false },
        ],
      },
    ],
    [toasts],
  );

  return {
    fetchData,
    filters,
  };
};

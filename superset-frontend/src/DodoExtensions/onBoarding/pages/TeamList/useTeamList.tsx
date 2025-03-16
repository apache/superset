import { useDispatch, useSelector } from 'react-redux';
import { useHistory } from 'react-router-dom';
import { useCallback } from 'react';
import { getUserInfo } from '../../model/selectors/getUserInfo';
import { loadTeamList } from '../../model/actions/loadTeamList';
import { FetchDataConfig } from '../../../../components/ListView';

export const useTeamList = () => {
  const dispatch = useDispatch();
  const user = useSelector(getUserInfo);
  const history = useHistory();

  if (!user.roles.Admin) {
    history.push('/superset/welcome/');
  }

  const fetchData = useCallback(
    (config: FetchDataConfig) => {
      dispatch(loadTeamList(config));
    },
    [dispatch],
  );

  return { fetchData };
};

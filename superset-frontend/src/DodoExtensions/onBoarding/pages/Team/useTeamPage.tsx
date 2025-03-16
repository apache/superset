import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';
import { debounce } from 'lodash';
import { t } from '@superset-ui/core';
import { loadTeamPage } from '../../model/actions/loadTeamPage';
import { getTeamPagePending } from '../../model/selectors/getTeamPagePending';
import { getTeamPageData } from '../../model/selectors/getTeamPageData';
import { SEARCH_MEMBER_DELAY } from '../../consts';
import { loadUsers } from '../../model/actions/loadUsers';
import { getUserSearchPending } from '../../model/selectors/getUserSearchPending';
import { getUserSearchData } from '../../model/selectors/getUserSearchData';
import { ONBOARDING_USER_SEARCH_CLEAR } from '../../model/types/userSearch.types';
import { User } from '../../types';
import { addTeamUser } from '../../model/actions/addTeamUser';
import { getTeamAddUserPending } from '../../model/selectors/getTeamAddUserPending';
import { getTeamAddUserSuccess } from '../../model/selectors/getTeamAddUserSuccess';
import { useToasts } from '../../../../components/MessageToasts/withToasts';
import { getTeamAddUserError } from '../../model/selectors/getTeamAddUserError';
import { ONBOARDING_TEAM_ADD_USER_CLEAR } from '../../model/types/teamAddUser.types';
import { removeTeamUser } from '../../model/actions/removeTeamUser';
import { getTeamRemoveUserSuccess } from '../../model/selectors/getTeamRemoveUserSuccess';
import { getTeamRemoveUserError } from '../../model/selectors/getTeamRemoveUserError';
import { ONBOARDING_TEAM_REMOVE_USER_CLEAR } from '../../model/types/teamRemoveUser.types';

export const useTeamPage = () => {
  const [memberToAdd, setMemberToAdd] = useState<User | null>(null);

  const toast = useToasts();

  const dispatch = useDispatch();
  const isLoading = useSelector(getTeamPagePending);
  const data = useSelector(getTeamPageData);

  const membersIsLoading = useSelector(getUserSearchPending);
  const memberList = useSelector(getUserSearchData);

  const addUserPending = useSelector(getTeamAddUserPending);
  const addUserSuccess = useSelector(getTeamAddUserSuccess);
  const addUserError = useSelector(getTeamAddUserError);

  const removeUserSuccess = useSelector(getTeamRemoveUserSuccess);
  const removeUserError = useSelector(getTeamRemoveUserError);

  const { id } = useParams<{ id: string }>();

  useEffect(() => {
    if (addUserSuccess) {
      // reload page after add user
      dispatch(loadTeamPage(id));
      toast.addSuccessToast(t('Member added successfully.'));
    }
  }, [addUserSuccess, dispatch, id, toast]);

  useEffect(() => {
    if (removeUserSuccess) {
      // reload page after add user
      dispatch(loadTeamPage(id));
      toast.addSuccessToast(t('Member removed successfully.'));
    }
  }, [dispatch, id, removeUserSuccess, toast]);

  useEffect(() => {
    if (addUserError) {
      toast.addDangerToast(
        t(`An error occurred while adding user:`) + addUserError,
      );
    }
  }, [addUserError, toast]);

  useEffect(() => {
    if (removeUserError) {
      toast.addDangerToast(
        t(`An error occurred while removing user:`) + removeUserError,
      );
    }
  }, [removeUserError, toast]);

  const removeFromTeam = useCallback(
    (memberId: number) => {
      if (data?.id) {
        dispatch(
          removeTeamUser({
            teamId: data?.id,
            userId: memberId,
          }),
        );
      }
    },
    [dispatch, data?.id],
  );

  const addToTeam = useCallback(() => {
    if (memberToAdd?.value && data?.id) {
      dispatch(
        addTeamUser({
          teamId: data?.id,
          userId: memberToAdd?.value,
        }),
      );
    }
    setMemberToAdd(null);
  }, [memberToAdd?.value, data?.id, dispatch]);

  const debouncedLoadMemberList = useMemo(
    () =>
      debounce((value: string) => {
        if (value.length >= 3) {
          dispatch(loadUsers(value));
        }
      }, SEARCH_MEMBER_DELAY),
    [dispatch],
  );

  const handleMemberSelect: (value: string, option: any) => void = useCallback(
    (value, option) => {
      if (!!option.value && !!option.label) {
        setMemberToAdd(option);
      }
    },
    [],
  );

  const handleOnChangeMember = useCallback((value, option) => {
    if (!option.value || !option.label) {
      setMemberToAdd(null);
    }
  }, []);

  useEffect(() => {
    dispatch(loadTeamPage(id));
    return () => {
      dispatch({ type: ONBOARDING_USER_SEARCH_CLEAR });
      dispatch({ type: ONBOARDING_TEAM_ADD_USER_CLEAR });
      dispatch({ type: ONBOARDING_TEAM_REMOVE_USER_CLEAR });
    };
  }, [dispatch, id]);

  return {
    isLoading,
    data,
    removeFromTeam,
    debouncedLoadMemberList,
    memberList,
    membersIsLoading,
    handleMemberSelect,
    memberToAdd,
    handleOnChangeMember,
    addToTeam,
    addUserPending,
    addUserError,
    removeUserError,
  };
};

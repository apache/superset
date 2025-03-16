import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';
import { t } from '@superset-ui/core';
import { loadRequest } from '../../model/actions/loadRequest';
import { getRequestLoading } from '../../model/selectors/getRequestLoading';
import { getRequestData } from '../../model/selectors/getRequestData';
import { MIN_TEAM_NAME_LENGTH } from '../../consts';
import { getTeamName } from '../../utils/getTeamName';
import { CreateTeamModalDto } from '../../components/CreateTeamModal/CreateTeamModal';
import { ConfirmCreateTeamModalDto } from '../../components/ConfirmCreateTeamModal/ConfirmCreateTeamModal';
import { UpdateUserDto } from './components/UpdateUser';
import { ONBOARDING_TEAM_SEARCH_CLEAR } from '../../model/types/teamSearch.types';
import { createTeam } from '../../model/actions/createTeam';
import { getCreateTeamData } from '../../model/selectors/getCreateTeamData';
import { useToasts } from '../../../../components/MessageToasts/withToasts';
import { getCreateTeamError } from '../../model/selectors/getCreateTeamError';
import { closeRequest } from '../../model/actions/closeRequest';
import { getCloseRequestError } from '../../model/selectors/getCloseRequestError';
import { getCloseRequestSuccess } from '../../model/selectors/getCloseRequestSuccess';
import { ONBOARDING_REQUEST_CLOSING_ERROR_CLEAR } from '../../model/types/request.types';
import { UserFromEnum } from '../../types';
import { getTeamSlug } from '../../utils/getTeamSlug';
import { ONBOARDING_TEAM_CREATE_CLEAR } from '../../model/types/teamCreate.types';

export const useRequest = () => {
  const [newTeam, setNewTeam] = useState<string | null>(null);
  const [existingTeam, setExistingTeam] = useState<any | null>(null);

  const [createTeamData, setCreateTeamData] =
    useState<CreateTeamModalDto | null>(null);
  const [confirmCreateTeamData, setConfirmCreateTeamData] =
    useState<ConfirmCreateTeamModalDto | null>(null);
  const [updateUserData, setUpdateUserData] = useState<UpdateUserDto | null>(
    null,
  );

  const { id } = useParams<{ id: string }>();
  const dispatch = useDispatch();
  const isLoading = useSelector(getRequestLoading);
  const requestData = useSelector(getRequestData);

  const createdTeamData = useSelector(getCreateTeamData);
  const createdTeamError = useSelector(getCreateTeamError);

  const closeRequestError = useSelector(getCloseRequestError);
  const closeRequestSuccess = useSelector(getCloseRequestSuccess);

  const toast = useToasts();

  useEffect(() => {
    // Первоначальная загрузка данных
    dispatch(loadRequest(id));
    return () => {
      dispatch({ type: ONBOARDING_TEAM_SEARCH_CLEAR });
      dispatch({ type: ONBOARDING_TEAM_CREATE_CLEAR });
      dispatch({ type: ONBOARDING_REQUEST_CLOSING_ERROR_CLEAR });
    };
  }, [dispatch, id]);

  useEffect(() => {
    // Команда создана успешно
    if (createdTeamData) {
      dispatch({ type: ONBOARDING_REQUEST_CLOSING_ERROR_CLEAR });

      toast.addSuccessToast(t('Team has been created successfully.'));

      setExistingTeam({
        value: createdTeamData.slug,
        label: createdTeamData.name,
        roles: createdTeamData.roles,
      });
      setNewTeam(null);

      setConfirmCreateTeamData(null);

      setUpdateUserData({
        userName: `${requestData?.firstName} ${requestData?.lastName} (${requestData?.email})`,
        teamName: createdTeamData.name,
        teamSlug: createdTeamData.slug,
        currentRoles: requestData?.currentRoles,
        requestedRoles: createdTeamData.roles,
        dodoRole: requestData?.dodoRole,
      });
    }
  }, [createdTeamData]);

  useEffect(() => {
    // Ошибка при создании команды
    if (createdTeamError) {
      toast.addDangerToast(t('An error occurred while creating the team'));
    }
  }, [createdTeamError, toast]);

  useEffect(() => {
    // Успех при закрытии заявки
    if (closeRequestSuccess && toast) {
      toast.addSuccessToast(t('Request closed successfully.'));
      setUpdateUserData(null);
    }
  }, [closeRequestSuccess, toast]);

  useEffect(() => {
    // Ошибка при закрытии заявки
    if (closeRequestError) {
      toast.addDangerToast(t('An error occurred while closing the request'));
    }
  }, [closeRequestError, toast]);

  const showCreateTeam = useCallback(() => {
    setCreateTeamData({
      userFrom: requestData?.userFrom ?? UserFromEnum.Unknown,
      name: newTeam,
      teamName: getTeamName(newTeam, requestData?.userFrom),
      teamSlug: getTeamSlug(newTeam, requestData?.userFrom),
      roles: [],
    });
  }, [newTeam, requestData?.userFrom]);

  const closeCreateTeam = useCallback(() => {
    setCreateTeamData(null);
  }, []);

  const tagClosable = useMemo(
    () => (!!existingTeam || !!newTeam) && !requestData?.isClosed,
    [existingTeam, newTeam, requestData?.isClosed],
  );

  const removeTeam = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      setNewTeam(null);
      setExistingTeam(null);
      e.preventDefault();
    },
    [setExistingTeam, setNewTeam],
  );

  const newTeamOK = useMemo(
    () => newTeam && newTeam?.length >= MIN_TEAM_NAME_LENGTH,
    [newTeam],
  );

  const teamOK = useMemo(
    () => (newTeam && newTeam?.length >= MIN_TEAM_NAME_LENGTH) || existingTeam,
    [existingTeam, newTeam],
  );

  const formatedTeamName = useMemo(() => {
    if (existingTeam) {
      return `${existingTeam.label}`;
    }
    if ((newTeam ?? '').trim().length >= MIN_TEAM_NAME_LENGTH) {
      const name = getTeamName(newTeam, requestData?.userFrom);
      return `${name}`;
    }
    return 'no team';
  }, [existingTeam, newTeam, requestData?.userFrom]);

  const openConfirmCreateTeam = useCallback(
    (data: CreateTeamModalDto) => {
      setCreateTeamData(null);
      dispatch({ type: ONBOARDING_TEAM_CREATE_CLEAR });
      setConfirmCreateTeamData({
        teamName: data.teamName,
        teamSlug: data.teamSlug,
        roles: data.roles,
        userFrom: data.userFrom ?? UserFromEnum.Unknown,
      });
    },
    [dispatch],
  );

  const createTeamHandle = useCallback(
    (value: ConfirmCreateTeamModalDto) => {
      dispatch(
        createTeam({
          name: value.teamName,
          roles: value.roles,
          slug: value.teamSlug,
          userFrom: value.userFrom,
        }),
      );
    },
    [dispatch],
  );

  const closeConfirmCreateTeam = useCallback(() => {
    setConfirmCreateTeamData(null);
  }, []);

  const showUpdateUser = useCallback(() => {
    setUpdateUserData({
      userName: `${requestData?.firstName} ${requestData?.lastName} (${requestData?.email})`,
      teamName: existingTeam.label,
      teamSlug: existingTeam.value,
      currentRoles: requestData?.currentRoles,
      requestedRoles: existingTeam.roles,
      dodoRole: requestData?.dodoRole,
    });
    dispatch({ type: ONBOARDING_REQUEST_CLOSING_ERROR_CLEAR });
  }, [
    requestData?.firstName,
    requestData?.lastName,
    requestData?.email,
    requestData?.currentRoles,
    requestData?.dodoRole,
    existingTeam?.label,
    existingTeam?.value,
    existingTeam?.roles,
    dispatch,
  ]);

  const closeUpdateUser = useCallback(() => {
    setUpdateUserData(null);
  }, []);

  const updateUser = useCallback(() => {
    if (updateUserData?.teamSlug && updateUserData.requestedRoles) {
      dispatch(
        closeRequest({
          id,
          slug: updateUserData.teamSlug,
          roles: updateUserData.requestedRoles,
        }),
      );
    }
  }, [updateUserData?.teamSlug, updateUserData?.requestedRoles, dispatch, id]);

  return {
    isLoading,
    requestData: requestData ?? undefined,
    newTeam,
    setNewTeam,
    existingTeam,
    setExistingTeam,
    showCreateTeam,
    closeCreateTeam,
    tagClosable,
    removeTeam,
    newTeamOK,
    teamOK,
    formatedTeamName,
    createTeamData,
    openConfirmCreateTeam,
    createTeamInHook: createTeamHandle,
    closeConfirmCreateTeam,
    confirmCreateTeamData,
    showUpdateUser,
    closeUpdateUser,
    updateUserData,
    updateUser,
    createdTeamError,
  };
};

import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { t } from '@superset-ui/core';
import { useDispatch, useSelector } from 'react-redux';
import withToasts, { useToasts } from 'src/components/MessageToasts/withToasts';
import SubMenu, { SubMenuProps } from 'src/features/home/SubMenu';
import ListView from 'src/components/ListView';
import { useTeamList } from './useTeamList';
import { columns, filters, initialSort } from './consts';
import { getTeamListPending } from '../../model/selectors/getTeamListPending';
import { getTeamListData } from '../../model/selectors/getTeamListData';
import { CreateTeamModal } from '../../components/CreateTeamModal/CreateTeamModal';
import { Role, UserFromEnum } from '../../types';
import {
  ConfirmCreateTeamModal,
  ConfirmCreateTeamModalDto,
} from '../../components/ConfirmCreateTeamModal/ConfirmCreateTeamModal';
import { createTeam } from '../../model/actions/createTeam';
import { getCreateTeamData } from '../../model/selectors/getCreateTeamData';
import { getCreateTeamError } from '../../model/selectors/getCreateTeamError';
import { ONBOARDING_TEAM_CREATE_CLEAR } from '../../model/types/teamCreate.types';

const PAGE_SIZE = 10;

interface TeamListProps {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
}

const TeamListPage: FC<TeamListProps> = ({
  addDangerToast,
  addSuccessToast,
}) => {
  const { fetchData } = useTeamList();

  const [isCreateTeam, setIsCreateTeam] = useState(false);
  const [createTeamDto, setCreateTeamDto] = useState<{
    userFrom: UserFromEnum;
    teamName: string;
    teamSlug: string;
    roles: Array<Role>;
  }>();

  const [showListView, setShowListView] = useState(true);

  const data = useSelector(getTeamListData);
  const loading = useSelector(getTeamListPending);

  const subMenuButtons: SubMenuProps['buttons'] = useMemo(
    () => [
      {
        name: t('Create team'),
        onClick: () => setIsCreateTeam(true),
        buttonStyle: 'secondary',
      },
    ],
    [],
  );

  const dispatch = useDispatch();
  const createdTeamData = useSelector(getCreateTeamData);
  const createdTeamError = useSelector(getCreateTeamError);
  const toast = useToasts();

  useEffect(() => {
    // Команда создана успешно
    if (createdTeamData) {
      toast.addSuccessToast(t('Team has been created successfully.'));

      setCreateTeamDto(undefined);
      setShowListView(true);
    }

    return () => {
      dispatch({ type: ONBOARDING_TEAM_CREATE_CLEAR });
    };
  }, [createdTeamData, dispatch, toast]);

  useEffect(() => {
    // Ошибка при создании команды
    if (createdTeamError) {
      toast.addDangerToast(t('An error occurred while creating the team'));
    }
    setShowListView(true);
  }, [createdTeamError, toast]);

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
      setShowListView(false);
    },
    [dispatch],
  );

  return (
    <div>
      <SubMenu name={t('Teams')} buttons={subMenuButtons} />
      {showListView && (
        <ListView
          className="team-list-view"
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
      )}
      {isCreateTeam && (
        <CreateTeamModal
          onCloseModal={() => {
            setIsCreateTeam(false);
          }}
          onSubmit={value => {
            setIsCreateTeam(false);
            setCreateTeamDto({
              ...value,
              userFrom: value.userFrom ?? UserFromEnum.Unknown,
            });
          }}
          data={{
            name: '',
            teamName: '',
            teamSlug: '',
            roles: [],
          }}
        />
      )}
      {createTeamDto && (
        <ConfirmCreateTeamModal
          data={createTeamDto}
          onCloseModal={() => setCreateTeamDto(undefined)}
          showUpdateUserInfo={false}
          onSubmit={createTeamHandle}
        />
      )}
    </div>
  );
};

export default withToasts(TeamListPage);

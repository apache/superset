import { FC, memo, useCallback, useMemo } from 'react';
import { AutoComplete, Input, Space, Tag as TagAnt, Typography } from 'antd';
import { styled, t } from '@superset-ui/core';
import { debounce } from 'lodash';
import { useDispatch, useSelector } from 'react-redux';
import { Role, UserFromEnum } from '../../../types';
import { getTeamName } from '../../../utils/getTeamName';
import { getTeamSlug } from '../../../utils/getTeamSlug';
import { MAX_TEAM_NAME_LENGTH, MIN_TEAM_NAME_LENGTH } from '../../../consts';
import { loadTeams } from '../../../model/actions/loadTeams';
import { getTeamSearchData } from '../../../model/selectors/getTeamSearchData';

const StyledSpace = styled(Space)`
  width: 100%;
`;

const SEARCH_TEAM_DELAY = 500;

type Props = {
  newTeam: string | null;
  existingTeam: any | null;
  setExistingTeam: (value: any | null) => void;
  setNewTeam: (value: string | null) => void;
  setRoles: (roles: Array<Role>) => void;
  userFrom: UserFromEnum;
  formatedTeamName: string;
};

export const CreateOrFindTeam: FC<Props> = memo(
  ({
    newTeam,
    existingTeam,
    setNewTeam,
    setExistingTeam,
    setRoles,
    userFrom,
    formatedTeamName,
  }) => {
    const dispatch = useDispatch();
    const { teamsIsLoading, teams } = useSelector(getTeamSearchData);

    const debouncedLoadTeamList = useMemo(
      () =>
        debounce(
          (value: string) => dispatch(loadTeams(userFrom, value)),
          SEARCH_TEAM_DELAY,
        ),
      [dispatch, userFrom],
    );

    const teamNameOnAutoComplete = useMemo(() => {
      if (existingTeam) {
        return existingTeam.label;
      }
      if (newTeam) {
        return newTeam;
      }
      return null;
    }, [existingTeam, newTeam]);

    const handleTeamChange: (value: string, option: any) => void = useCallback(
      (value, option) => {
        if (!!option.value && !!option.label) {
          setExistingTeam(option);
          setNewTeam(null);
          setRoles(option.roles);
        } else {
          if (value) {
            // const reg = /^-?\d*(\.\d*)?$/; for numbers
            const reg = /^-?[0-9a-zA-Z ]*(\.[0-9a-zA-Z ]*)?$/;
            if (reg.test(value) && value.length <= MAX_TEAM_NAME_LENGTH) {
              setNewTeam(value);
            }
          } else {
            setNewTeam(null);
            setRoles([]);
          }
          setExistingTeam(null);
        }
      },
      [setExistingTeam, setNewTeam, setRoles],
    );

    const tagClosable = useMemo(
      () => !!existingTeam || !!newTeam,
      [existingTeam, newTeam],
    );

    const removeTeam = useCallback(
      (e: React.MouseEvent<HTMLElement>) => {
        setNewTeam(null);
        setExistingTeam(null);
        setRoles([]);
        e.preventDefault();
      },
      [setExistingTeam, setNewTeam, setRoles],
    );

    const teamDescription = useMemo(() => {
      if (existingTeam) {
        return `[${existingTeam.label} (${existingTeam.value}] ${t(
          'is a known command, so you can enter the team automatically.',
        )}`;
      }
      if ((newTeam ?? '').trim().length >= MIN_TEAM_NAME_LENGTH) {
        const name = getTeamName(newTeam, userFrom);
        const tag = getTeamSlug(newTeam, userFrom);
        return `[${name} (${tag})] ${t(
          'is a new team, so Superset admins will have to evaluate this request.',
        )}`;
      }
      return '';
    }, [existingTeam, newTeam, userFrom]);

    return (
      <>
        <Typography.Title level={5}>
          {t('Create of find your team')}
        </Typography.Title>

        <StyledSpace direction="vertical" size="small">
          <Typography.Text type="secondary">
            {t('All C-level people please select ‘c_level’')}
          </Typography.Text>

          <AutoComplete
            value={teamNameOnAutoComplete}
            options={teams}
            style={{ width: '100%' }}
            onSearch={debouncedLoadTeamList}
            onChange={handleTeamChange}
          >
            <Input.Search
              placeholder={t('your team')}
              loading={teamsIsLoading}
              allowClear
              enterButton
              size="large"
            />
          </AutoComplete>

          <Space direction="horizontal" size="small">
            <Typography.Text>{t('Your team name is')}</Typography.Text>
            <TagAnt color="#ff6900" closable={tagClosable} onClose={removeTeam}>
              {formatedTeamName}
            </TagAnt>
          </Space>

          {teamDescription && (
            <Typography.Text type="secondary">
              {teamDescription}
            </Typography.Text>
          )}
        </StyledSpace>
      </>
    );
  },
);

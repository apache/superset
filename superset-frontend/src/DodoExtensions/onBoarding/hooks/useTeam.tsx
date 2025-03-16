import { useDispatch } from 'react-redux';
import { useCallback, useMemo } from 'react';
import { debounce } from 'lodash';
import { loadTeams } from '../model/actions/loadTeams';
import { Role, UserFromEnum } from '../types';
import { MAX_TEAM_NAME_LENGTH, SEARCH_TEAM_DELAY } from '../consts';

export const useTeam = ({
  userFrom,
  newTeam,
  existingTeam,
  setNewTeam,
  setExistingTeam,
  setRoles,
}: {
  userFrom: UserFromEnum;
  newTeam: string | null;
  existingTeam: any | null;
  setNewTeam: (value: string | null) => void;
  setExistingTeam: (value: any | null) => void;
  setRoles?: (value: Array<Role>) => void;
}) => {
  const dispatch = useDispatch();

  const debouncedLoadTeamList = useMemo(
    () =>
      debounce((value: string) => {
        if (value.length >= 3) {
          dispatch(loadTeams(userFrom, value));
        }
      }, SEARCH_TEAM_DELAY),
    [dispatch, userFrom],
  );

  const handleTeamChange: (value: string, option: any) => void = useCallback(
    (value, option) => {
      if (!!option.value && !!option.label) {
        setExistingTeam(option);
        setNewTeam(null);
        setRoles?.(option.roles);
      } else {
        if (value) {
          // const reg = /^-?\d*(\.\d*)?$/; for numbers
          const reg = /^-?[0-9a-zA-Z ]*(\.[0-9a-zA-Z ]*)?$/;
          if (reg.test(value) && value.length <= MAX_TEAM_NAME_LENGTH) {
            setNewTeam(value);
          }
        } else {
          setNewTeam(null);
          setRoles?.([]);
        }
        setExistingTeam(null);
      }
    },
    [setExistingTeam, setNewTeam, setRoles],
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

  return {
    debouncedLoadTeamList,
    handleTeamChange,
    teamNameOnAutoComplete,
  };
};

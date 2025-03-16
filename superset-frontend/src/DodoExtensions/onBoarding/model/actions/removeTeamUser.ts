import { Dispatch } from '@reduxjs/toolkit';
import {
  ONBOARDING_TEAM_REMOVE_USER_ERROR,
  ONBOARDING_TEAM_REMOVE_USER_PENDING,
  ONBOARDING_TEAM_REMOVE_USER_SUCCESS,
} from '../types/teamRemoveUser.types';
import { postTeamRemoveUserRepository } from '../../repository/postTeamRemoveUser.repository';

type Params = {
  teamId: number;
  userId: number;
};

export function removeTeamUser(params: Params) {
  return async function (dispatch: Dispatch) {
    try {
      dispatch({
        type: ONBOARDING_TEAM_REMOVE_USER_PENDING,
      });

      await postTeamRemoveUserRepository(params);

      dispatch({
        type: ONBOARDING_TEAM_REMOVE_USER_SUCCESS,
      });
    } catch (response) {
      const { statusText } = response;
      const error = await response.json();

      dispatch({
        type: ONBOARDING_TEAM_REMOVE_USER_ERROR,
        payload: {
          error: `${statusText}:${JSON.stringify(error)}`,
        },
      });
    }
  };
}

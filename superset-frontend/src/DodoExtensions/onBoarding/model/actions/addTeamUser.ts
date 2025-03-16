import { Dispatch } from '@reduxjs/toolkit';
import {
  ONBOARDING_TEAM_ADD_USER_ERROR,
  ONBOARDING_TEAM_ADD_USER_PENDING,
  ONBOARDING_TEAM_ADD_USER_SUCCESS,
} from '../types/teamAddUser.types';
import { postTeamAddUserRepository } from '../../repository/postTeamAddUser.repository';

type Params = {
  teamId: number;
  userId: number;
};

export function addTeamUser(params: Params) {
  return async function (dispatch: Dispatch) {
    try {
      dispatch({
        type: ONBOARDING_TEAM_ADD_USER_PENDING,
      });

      await postTeamAddUserRepository(params);

      dispatch({
        type: ONBOARDING_TEAM_ADD_USER_SUCCESS,
      });
    } catch (response) {
      const { statusText } = response;
      const error = await response.json();

      dispatch({
        type: ONBOARDING_TEAM_ADD_USER_ERROR,
        payload: {
          error: `${statusText}:${JSON.stringify(error)}`,
        },
      });
    }
  };
}

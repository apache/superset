import { Dispatch } from '@reduxjs/toolkit';
import { postTeamRepository } from '../../repository/postTeam.repository';
import { Role, UserFromEnum } from '../../types';
import {
  ONBOARDING_TEAM_CREATE_ERROR,
  ONBOARDING_TEAM_CREATE_PENDING,
  ONBOARDING_TEAM_CREATE_SUCCESS,
} from '../types/teamCreate.types';

type Params = {
  userFrom: UserFromEnum;
  name: string;
  slug: string;
  roles: Array<Role>;
};

export function createTeam(params: Params) {
  return async function (dispatch: Dispatch) {
    try {
      dispatch({
        type: ONBOARDING_TEAM_CREATE_PENDING,
      });

      await postTeamRepository(params);

      dispatch({
        type: ONBOARDING_TEAM_CREATE_SUCCESS,
        payload: {
          slug: params.slug,
          name: params.name,
          roles: params.roles,
        },
      });
    } catch (response) {
      const { statusText } = response;
      const error = await response.json();

      dispatch({
        type: ONBOARDING_TEAM_CREATE_ERROR,
        payload: {
          error: `${statusText}:${JSON.stringify(error)}`,
        },
      });
    }
  };
}

import { Dispatch } from '@reduxjs/toolkit';
import {
  ONBOARDING_TEAM_PAGE_ERROR,
  ONBOARDING_TEAM_PAGE_PENDING,
  ONBOARDING_TEAM_PAGE_SUCCESS,
} from '../types/teamPage.types';
import { getTeamPageRepository } from '../../repository/getTeamPage.repository';

export function loadTeamPage(id: string) {
  return async function (dispatch: Dispatch) {
    try {
      dispatch({
        type: ONBOARDING_TEAM_PAGE_PENDING,
      });

      const data = await getTeamPageRepository(id);

      dispatch({
        type: ONBOARDING_TEAM_PAGE_SUCCESS,
        payload: data,
      });
    } catch (response) {
      const { statusText } = response;
      const error = await response.json();

      dispatch({
        type: ONBOARDING_TEAM_PAGE_ERROR,
        payload: {
          error: `${statusText}:${JSON.stringify(error)}`,
        },
      });
    }
  };
}

import { Dispatch } from '@reduxjs/toolkit';
import { FetchDataConfig } from '../../../../components/ListView';
import {
  ONBOARDING_TEAM_LIST_ERROR,
  ONBOARDING_TEAM_LIST_PENDING,
  ONBOARDING_TEAM_LIST_SUCCESS,
} from '../types/teamList.types';
import { getTeamListRepository } from '../../repository/getTeamList.repository';

export function loadTeamList(config: FetchDataConfig) {
  return async function (dispatch: Dispatch) {
    try {
      dispatch({
        type: ONBOARDING_TEAM_LIST_PENDING,
      });

      const data = await getTeamListRepository(config);

      dispatch({
        type: ONBOARDING_TEAM_LIST_SUCCESS,
        payload: data,
      });
    } catch (response) {
      const { statusText } = response;
      const error = await response.json();

      dispatch({
        type: ONBOARDING_TEAM_LIST_ERROR,
        payload: {
          error: `${statusText}:${JSON.stringify(error)}`,
        },
      });
    }
  };
}

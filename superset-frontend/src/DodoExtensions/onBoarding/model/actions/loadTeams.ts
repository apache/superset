import { Dispatch } from '@reduxjs/toolkit';
import { UserFromEnum } from '../../types';

import { getTeamsRepository } from '../../repository/getTeams.repository';
import {
  ONBOARDING_TEAM_SEARCH_ERROR,
  ONBOARDING_TEAM_SEARCH_PENDING,
  ONBOARDING_TEAM_SEARCH_SUCCESS,
} from '../types/teamSearch.types';

let beforeSendToBackendQuery = '';

export function loadTeams(userFrom: UserFromEnum, query: string) {
  return async function (dispatch: Dispatch) {
    try {
      dispatch({
        type: ONBOARDING_TEAM_SEARCH_PENDING,
      });

      beforeSendToBackendQuery = query;

      const data = await getTeamsRepository(userFrom, query);

      // to handle backend raise condition
      if (query === beforeSendToBackendQuery) {
        dispatch({
          type: ONBOARDING_TEAM_SEARCH_SUCCESS,
          payload: data,
        });
      }
    } catch (e) {
      if (e.status === 404) {
        // No team found
        dispatch({
          type: ONBOARDING_TEAM_SEARCH_SUCCESS,
          payload: [],
        });
      } else {
        dispatch({
          type: ONBOARDING_TEAM_SEARCH_ERROR,
          payload: {
            error: e.message,
          },
        });
      }
    }
  };
}

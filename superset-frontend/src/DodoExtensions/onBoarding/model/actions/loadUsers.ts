import { Dispatch } from '@reduxjs/toolkit';
import { getUsersRepository } from '../../repository/getUsers.repository';
import {
  ONBOARDING_USER_SEARCH_ERROR,
  ONBOARDING_USER_SEARCH_PENDING,
  ONBOARDING_USER_SEARCH_SUCCESS,
} from '../types/userSearch.types';

let beforeSendToBackendQuery = '';

export function loadUsers(query: string) {
  return async function (dispatch: Dispatch) {
    try {
      dispatch({
        type: ONBOARDING_USER_SEARCH_PENDING,
      });

      beforeSendToBackendQuery = query;

      const data = await getUsersRepository(query);

      // to handle backend raise condition
      if (query === beforeSendToBackendQuery) {
        dispatch({
          type: ONBOARDING_USER_SEARCH_SUCCESS,
          payload: data,
        });
      }
    } catch (e) {
      dispatch({
        type: ONBOARDING_USER_SEARCH_ERROR,
        payload: {
          error: e.message,
        },
      });
    }
  };
}

import {
  ONBOARDING_TEAM_LIST_ERROR,
  ONBOARDING_TEAM_LIST_PENDING,
  ONBOARDING_TEAM_LIST_SUCCESS,
  OnboardingTeamListAction,
  OnBoardingTeamListState,
} from '../types/teamList.types';

const initialState: OnBoardingTeamListState = {
  pending: false,
  error: null,
  data: null,
};

export const onboardingTeamListSlice = (
  state: OnBoardingTeamListState = initialState,
  action: OnboardingTeamListAction,
): OnBoardingTeamListState => {
  switch (action.type) {
    case ONBOARDING_TEAM_LIST_PENDING: {
      return {
        ...state,
        pending: true,
        error: null,
        data: null,
      };
    }
    case ONBOARDING_TEAM_LIST_SUCCESS: {
      return {
        ...state,
        pending: false,
        error: null,
        data: action.payload,
      };
    }
    case ONBOARDING_TEAM_LIST_ERROR: {
      return {
        ...state,
        pending: false,
        error: action.payload.error,
        data: null,
      };
    }

    default: {
      return state;
    }
  }
};

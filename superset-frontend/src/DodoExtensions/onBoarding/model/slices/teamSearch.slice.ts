import {
  ONBOARDING_TEAM_SEARCH_CLEAR,
  ONBOARDING_TEAM_SEARCH_ERROR,
  ONBOARDING_TEAM_SEARCH_PENDING,
  ONBOARDING_TEAM_SEARCH_SUCCESS,
  OnboardingTeamSearchAction,
  OnboardingTeamSearchState,
} from '../types/teamSearch.types';

const initialState: OnboardingTeamSearchState = {
  pending: false,
  data: [],
  error: null,
};

export const onboardingTeamSearchSlice = (
  state: OnboardingTeamSearchState = initialState,
  action: OnboardingTeamSearchAction,
): OnboardingTeamSearchState => {
  switch (action.type) {
    case ONBOARDING_TEAM_SEARCH_PENDING: {
      return { ...state, pending: true };
    }
    case ONBOARDING_TEAM_SEARCH_SUCCESS: {
      return { ...state, pending: false, data: action.payload };
    }
    case ONBOARDING_TEAM_SEARCH_ERROR: {
      return {
        ...state,
        pending: false,
        error: action.payload.error,
      };
    }
    case ONBOARDING_TEAM_SEARCH_CLEAR: {
      return {
        ...state,
        data: [],
      };
    }

    default: {
      return state;
    }
  }
};

import {
  ONBOARDING_TEAM_PAGE_ERROR,
  ONBOARDING_TEAM_PAGE_PENDING,
  ONBOARDING_TEAM_PAGE_SUCCESS,
  OnboardingTeamPageAction,
  OnBoardingTeamPageState,
} from '../types/teamPage.types';

const initialState: OnBoardingTeamPageState = {
  pending: false,
  error: null,
  data: null,
};

export const onboardingTeamPageSlice = (
  state: OnBoardingTeamPageState = initialState,
  action: OnboardingTeamPageAction,
): OnBoardingTeamPageState => {
  switch (action.type) {
    case ONBOARDING_TEAM_PAGE_PENDING: {
      return {
        ...state,
        pending: true,
        error: null,
        data: null,
      };
    }
    case ONBOARDING_TEAM_PAGE_SUCCESS: {
      return {
        ...state,
        pending: false,
        error: null,
        data: action.payload,
      };
    }
    case ONBOARDING_TEAM_PAGE_ERROR: {
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

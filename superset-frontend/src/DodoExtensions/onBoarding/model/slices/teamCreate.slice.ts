import {
  ONBOARDING_TEAM_CREATE_CLEAR,
  ONBOARDING_TEAM_CREATE_ERROR,
  ONBOARDING_TEAM_CREATE_PENDING,
  ONBOARDING_TEAM_CREATE_SUCCESS,
  OnboardingTeamCreateAction,
  OnboardingTeamCreateState,
} from '../types/teamCreate.types';

const initialState: OnboardingTeamCreateState = {
  pending: false,
  error: null,
  data: null,
};

export const onboardingTeamCreateSlice = (
  state: OnboardingTeamCreateState = initialState,
  action: OnboardingTeamCreateAction,
): OnboardingTeamCreateState => {
  switch (action.type) {
    case ONBOARDING_TEAM_CREATE_PENDING: {
      return {
        ...state,
        pending: true,
        error: null,
        data: null,
      };
    }
    case ONBOARDING_TEAM_CREATE_SUCCESS: {
      return {
        ...state,
        pending: false,
        error: null,
        data: action.payload,
      };
    }
    case ONBOARDING_TEAM_CREATE_ERROR: {
      return {
        ...state,
        pending: false,
        data: null,
        error: action.payload.error,
      };
    }
    case ONBOARDING_TEAM_CREATE_CLEAR: {
      return {
        ...state,
        pending: false,
        error: null,
        data: null,
      };
    }

    default: {
      return state;
    }
  }
};

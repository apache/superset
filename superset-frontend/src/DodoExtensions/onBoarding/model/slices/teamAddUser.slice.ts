import {
  ONBOARDING_TEAM_ADD_USER_CLEAR,
  ONBOARDING_TEAM_ADD_USER_ERROR,
  ONBOARDING_TEAM_ADD_USER_PENDING,
  ONBOARDING_TEAM_ADD_USER_SUCCESS,
  OnboardingTeamAddUserAction,
  OnboardingTeamAddUserState,
} from '../types/teamAddUser.types';

const initialState: OnboardingTeamAddUserState = {
  pending: false,
  success: false,
  error: null,
};

export const onboardingTeamAddUserSlice = (
  state: OnboardingTeamAddUserState = initialState,
  action: OnboardingTeamAddUserAction,
): OnboardingTeamAddUserState => {
  switch (action.type) {
    case ONBOARDING_TEAM_ADD_USER_PENDING: {
      return {
        pending: true,
        error: null,
        success: false,
      };
    }
    case ONBOARDING_TEAM_ADD_USER_SUCCESS: {
      return {
        pending: false,
        error: null,
        success: true,
      };
    }
    case ONBOARDING_TEAM_ADD_USER_ERROR: {
      return {
        pending: false,
        error: action.payload.error,
        success: false,
      };
    }
    case ONBOARDING_TEAM_ADD_USER_CLEAR: {
      return {
        ...initialState,
      };
    }

    default: {
      return state;
    }
  }
};

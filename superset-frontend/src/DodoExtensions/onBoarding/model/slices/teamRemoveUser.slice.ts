import {
  ONBOARDING_TEAM_REMOVE_USER_CLEAR,
  ONBOARDING_TEAM_REMOVE_USER_ERROR,
  ONBOARDING_TEAM_REMOVE_USER_PENDING,
  ONBOARDING_TEAM_REMOVE_USER_SUCCESS,
  OnboardingTeamRemoveUserAction,
  OnboardingTeamRemoveUserState,
} from '../types/teamRemoveUser.types';

const initialState: OnboardingTeamRemoveUserState = {
  pending: false,
  success: false,
  error: null,
};

export const onboardingTeamRemoveUserSlice = (
  state: OnboardingTeamRemoveUserState = initialState,
  action: OnboardingTeamRemoveUserAction,
): OnboardingTeamRemoveUserState => {
  switch (action.type) {
    case ONBOARDING_TEAM_REMOVE_USER_PENDING: {
      return {
        pending: true,
        error: null,
        success: false,
      };
    }
    case ONBOARDING_TEAM_REMOVE_USER_SUCCESS: {
      return {
        pending: false,
        error: null,
        success: true,
      };
    }
    case ONBOARDING_TEAM_REMOVE_USER_ERROR: {
      return {
        pending: false,
        error: action.payload.error,
        success: false,
      };
    }
    case ONBOARDING_TEAM_REMOVE_USER_CLEAR: {
      return {
        ...initialState,
      };
    }

    default: {
      return state;
    }
  }
};

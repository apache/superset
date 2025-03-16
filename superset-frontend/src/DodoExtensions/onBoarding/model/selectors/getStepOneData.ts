import { OnboardingStartState } from '../types/start.types';

export const getOnboardingStartedTime = (state: {
  onboardingStart: OnboardingStartState;
}) => ({
  firstName: state.onboardingStart.firstName,
  lastName: state.onboardingStart.lastName,
  email: state.onboardingStart.email,
});

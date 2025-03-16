import { OnboardingStartState } from '../types/start.types';

export const getOnboardingStartedTime = (state: {
  onboardingStart: OnboardingStartState;
}) => state.onboardingStart.onboardingStartedTime;

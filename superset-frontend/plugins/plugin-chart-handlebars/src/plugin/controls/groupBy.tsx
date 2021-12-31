import {
  ControlPanelState,
  ControlSetItem,
  ControlState,
  sharedControls,
} from '@superset-ui/chart-controls';
import { isAggMode, validateAggControlValues } from './shared';

export const GroupByControlSetItem: ControlSetItem = {
  name: 'groupby',
  override: {
    visibility: isAggMode,
    mapStateToProps: (state: ControlPanelState, controlState: ControlState) => {
      const { controls } = state;
      const originalMapStateToProps = sharedControls?.groupby?.mapStateToProps;
      const newState = originalMapStateToProps?.(state, controlState) ?? {};
      newState.externalValidationErrors = validateAggControlValues(controls, [
        controls.metrics?.value,
        controls.percent_metrics?.value,
        controlState.value,
      ]);

      return newState;
    },
    rerender: ['metrics', 'percent_metrics'],
  },
};

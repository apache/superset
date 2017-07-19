import * as actions from '../actions/globalActions';
import ControlStore from '../stores/ControlStore';

export const controlReducer = function (currentState = new ControlStore(), action) {
  let state = currentState;
  if (state.constructor.name !== ControlStore.name) {
    state = new ControlStore(state);
  }
  const actionHandlers = {
    [actions.RESET]() {
      return new ControlStore();
    },
    [actions.SET_AUTO_RUN]() {
      if (state.autoRun !== action.autoRun || state.run !== action.autoRun) {
        return new ControlStore(state, {
          autoRun: action.autoRun,
          run: action.autoRun,
        });
      }
      return state;
    },
    [actions.SET_RUN]() {
      const run = action.run || state.autoRun;
      if (state.run !== run) {
        return new ControlStore(state, { run });
      }
      return state;
    },
    [actions.ABORT]() {
      if (state.queryRequest &&
          state.queryRequest.abort) {
        state.queryRequest.abort();
      }
      return state;
    },
    [actions.SET_IS_RUNNING]() {
      if (action.isRunning &&
          state.queryRequest !== action.queryRequest &&
          state.queryRequest &&
          state.queryRequest.abort) {
        state.queryRequest.abort();
      }
      return new ControlStore(state, {
        isRunning: action.isRunning || state.queryRequest !== action.queryRequest,
        queryRequest: action.isRunning ? action.queryRequest : state.queryRequest,
      });
    },
    [actions.SET_ERROR]() {
      if (!action.error !== !state.error) {
        return new ControlStore(state, {
          error: action.error,
          run: state.autoRun,
        });
      }
      return state;
    },
  };
  if (action.type in actionHandlers) {
    return actionHandlers[action.type]();
  }
  return state;
};


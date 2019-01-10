import {
  FETCH_ALL_SLICES_FAILED,
  FETCH_ALL_SLICES_STARTED,
  SET_ALL_SLICES,
} from '../actions/sliceEntities';
import { t } from '../../locales';

export const initSliceEntities = {
  slices: {},
  isLoading: true,
  errorMessage: null,
  lastUpdated: 0,
};

export default function sliceEntitiesReducer(
  state = initSliceEntities,
  action,
) {
  const actionHandlers = {
    [FETCH_ALL_SLICES_STARTED]() {
      return {
        ...state,
        isLoading: true,
      };
    },
    [SET_ALL_SLICES]() {
      return {
        ...state,
        isLoading: false,
        slices: { ...state.slices, ...action.slices }, // append more slices
        lastUpdated: new Date().getTime(),
      };
    },
    [FETCH_ALL_SLICES_FAILED]() {
      const respJSON = action.error.responseJSON;
      const errorMessage =
        t('Sorry, there was an error fetching slices: ') +
        (respJSON && respJSON.message)
          ? respJSON.message
          : action.error.responseText;
      return {
        ...state,
        isLoading: false,
        errorMessage,
        lastUpdated: new Date().getTime(),
      };
    },
  };

  if (action.type in actionHandlers) {
    return actionHandlers[action.type]();
  }
  return state;
}

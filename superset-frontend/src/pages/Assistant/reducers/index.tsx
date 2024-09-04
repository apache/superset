import { data } from 'jquery';
import { 
    AssistantActions,
    SelectAssistantSuggestionAction,
    AssistantDataChangedAction
} from '../actions';
import * as ActionTypes from '../actions/types';

export default function AssistantReducer(
    state = {
        enabled: false,
    }, 
    action: AssistantActions
){
    switch(action.type){
        case ActionTypes.SELECT_SUGGESTION:
            return {
                ...state,
                selected: {
                    ...(action as SelectAssistantSuggestionAction).payload
                },
                enabled: true
            }

        case ActionTypes.ASSISTANT_DATA_CHANGED:
            return {
                ...state,
                data: (action as AssistantDataChangedAction).payload
            }
        default:
            return state;
    }
}
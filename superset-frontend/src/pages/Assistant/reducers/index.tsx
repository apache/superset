import { 
    AssistantActions,
    SelectAssistantSuggestionAction 
} from '../actions';
import * as ActionTypes from '../actions/types';

export default function AssistantReducer(
    state = {}, action: AssistantActions
){
    switch(action.type){
        case ActionTypes.SELECT_SUGGESTION:
            return {
                ...state,
                ...(action as SelectAssistantSuggestionAction).payload
            }
        default:
            return state;
    }
}
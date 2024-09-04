

import { DatasourceProps } from '../ContextBuilder/Datasource';
import * as ActionTypes from './types';

export interface AssistantActions {
    type: string;
}

/**
 * Assistant Action Selection Payload
 */
export interface SelectAssistantSuggestionAction extends AssistantActions {
    payload: {
        databaseId: string;
        schemaName: string;
        viz_datasources: string[];
        viz_type: string;
        llm_optimized: string; // llm instructions
    };
}

/**
 * Assistant actions sends the selected suggestion to the reducer
 */
export const selectAssistantSuggestion = (payload: SelectAssistantSuggestionAction['payload']): SelectAssistantSuggestionAction => {
    return {
        type: ActionTypes.SELECT_SUGGESTION,
        payload
    }
};

/**
 * Assistant Data Changed Payload
 */
export interface AssistantDataChangedAction extends AssistantActions {
    payload: DatasourceProps[];
};

/**
 * Assistant actions sends the selected suggestion to the reducer
 */
export const assistantDataChanged = (payload: AssistantDataChangedAction['payload']): AssistantDataChangedAction => {
    return {
        type: ActionTypes.ASSISTANT_DATA_CHANGED,
        payload
    }
}
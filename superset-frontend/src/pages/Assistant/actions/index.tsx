

import * as ActionTypes from './types';

export interface AssistantActions {
    type: string;
}

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
 * Assistant actions
 * returns
 */
export const selectAssistantSuggestion = (payload: SelectAssistantSuggestionAction['payload']): SelectAssistantSuggestionAction => {
    return {
        type: ActionTypes.SELECT_SUGGESTION,
        payload
    }
};
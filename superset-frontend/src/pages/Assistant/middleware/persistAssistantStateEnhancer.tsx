import persistState from 'redux-localstorage';

/**
 * Assistant Local Storage State Enhancer
 */

const assistantPersistConfig = {
    paths: ['assistant'],
    config: {
        key: 'assistant',
        slicer: (paths: string[]) => (state: any) => {
            console.log("persistAssistantStateEnhancer slicer paths", paths);
            console.log("persistAssistantStateEnhancer slicer state", state);
            const assistantState = state['assistant'];
            return assistantState;
        },
        merge: (initialState: any, persistedState: any) => {
            console.log("persistAssistantStateEnhancer merge initialState", initialState);
            console.log("persistAssistantStateEnhancer merge persistedState", persistedState);
            const mergedState = {
                ...initialState,
                assistant: {
                    ...initialState.assistant,
                    ...persistedState
                }
            }
            console.log("persistAssistantStateEnhancer merge mergedState", mergedState);
            return mergedState;
        }
    }
}

export const persistAssistantStateEnhancer = persistState(
    assistantPersistConfig.paths,
    assistantPersistConfig.config
);
import { AssistantSuggestion, AssistantSuggestionProps } from "./AssistantSuggestion";

/**
 * Component that displays the 2 by 2 grid with max of 4 of suggestions for the assistant
 */

/**
 * Props
 */
export interface AssistantSuggestionsGridProps {
    suggestions: AssistantSuggestionProps[];
}

/**
 * AssistantSuggestionsGrid Component
 */

export function AssistantSuggestionsGrid(props: AssistantSuggestionsGridProps) {
    return (
        <div style={{
            // wraps the suggestions grid in a 1h / 1.5w aspect ratio with max wisdth of 500px
            maxWidth: '500px',
            width: '100%',
            overflow: 'auto',
        }} >
            <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gridGap: '4px',
            }}>
                {props.suggestions.map((suggestion, index) => {
                    if (index < 4) {
                        return (
                            <AssistantSuggestion
                                key={index}
                                title={suggestion.title}
                                suggestion={suggestion.suggestion}
                                backgroundColor={suggestion.backgroundColor}
                            />
                        );
                    } else {
                        return null;
                    }
                })}
            </div>
        </div>
    );
}
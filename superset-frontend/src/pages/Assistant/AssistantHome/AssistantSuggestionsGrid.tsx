import { AssistantSuggestion, AssistantSuggestionProps } from "./AssistantSuggestion";
import React, { useEffect, useState } from "react";

/**
 * Component that displays the 2 by 2 grid with max of 4 of suggestions for the assistant
 */

/**
 * Props
 */
export interface AssistantSuggestionsGridProps {
    suggestions: AssistantSuggestionProps[];
    actions: any;
}

/**
 * AssistantSuggestionsGrid Component
 */

export function AssistantSuggestionsGrid(props: AssistantSuggestionsGridProps) {
    const [suggestions, setSuggestions] = useState<AssistantSuggestionProps[]>(props.suggestions);

    useEffect(() => {
        setSuggestions(props.suggestions);
    }, [props.suggestions]);

    console.log("AssistantSuggestionsGrid : Props", suggestions);

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
                {suggestions.map((suggestion, index) => {
                    if (index < 8) {
                        return (
                            <AssistantSuggestion
                                {...{
                                    ...suggestion,
                                    actions: props.actions
                                }}
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
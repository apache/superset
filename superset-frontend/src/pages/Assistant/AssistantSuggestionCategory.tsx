import { margin } from 'polished';
import { AssistantSuggestionsGrid, AssistantSuggestionsGridProps } from './AssistantSuggestionsGrid';

/**
 * Component that Displays Assistants Suggestion Category and Suggestions
 */

/** Props extends AssistantSuggestionsGridProps 
 * categoryTitle: string;
 * categoryDescription: string;
 * suggestions: AssistantSuggestionsGridProps;
 */

export interface AssistantSuggestionCategoryProps extends AssistantSuggestionsGridProps {
    categoryTitle: string;
    categoryDescription: string;
    backgroundGradientStart?: string;
    backgroundGradientEnd?: string;
}

/**
 * AssistantSuggestionCategory Component
 */
export function AssistantSuggestionCategory(props: AssistantSuggestionCategoryProps) {

    const bgGradientStart = props.backgroundGradientStart || '#FF9398';
    const bgGradientEnd = props.backgroundGradientEnd || '#FF4049';

    return (
        <div style={{
                display: 'flex',
                flexDirection: 'row',
                width: 'fit-content',
                height: 'fit-content',
                borderRadius: '16px',
                padding: '20px',
                background: `linear-gradient(180deg, ${bgGradientStart} 0%, ${bgGradientEnd} 100%)`,
            }}>
            <div style={{
                    padding: '10px',
                    paddingLeft: '0px',
                    width: '60px',
                    height: '60px',
                }}>
                <img style={{width:'100%', height:'100%' }} src='/static/assets/images/assistant_suggestion_icon.svg'/>
            </div>
            <div style={{
                padding: '10px'
            }}>
                <h4 style={{margin:0}} >{props.categoryTitle}</h4>
                <p>{props.categoryDescription}</p>
                <AssistantSuggestionsGrid {...props} />
            </div>
        </div>
    )

}
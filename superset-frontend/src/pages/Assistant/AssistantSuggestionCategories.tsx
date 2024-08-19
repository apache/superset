import { AssistantSuggestionCategory, AssistantSuggestionCategoryProps} from './AssistantSuggestionCategory';




export interface AssistantCategoriesProps {
    categories: AssistantSuggestionCategoryProps[];
}



export function AssistantSuggestionCategories(props: AssistantCategoriesProps) {
    return (
        <div style={{
            width: '100%',
            display: 'flex',
            justifyContent: 'center',
            alignContent: 'center',
            flexFlow: 'row wrap',
            gap: '10px',
            padding: '10px',
          }} >
            {props.categories.map((category, index) => (
                <AssistantSuggestionCategory key={index} {...category} />
            ))}
        </div>
    );
}
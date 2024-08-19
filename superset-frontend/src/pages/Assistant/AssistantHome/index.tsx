import { AssistantSuggestionsGridProps } from './AssistantSuggestionsGrid';
import { AssistantSuggestionCategoryProps} from './AssistantSuggestionCategory';
import { AssistantCategoriesProps, AssistantSuggestionCategories } from './AssistantSuggestionCategories';
import { AssistantWelcomeMessage } from './AssistantWelcomeMessage';
import { AssistantPrompt } from './AssistantPrompt';

const sampleSuggestions: AssistantSuggestionsGridProps = {
  suggestions: [
    {
      title: 'Suggestion 1',
      suggestion: 'Suggestion rational Lorem Ipsum Long text',
      backgroundColor: '#FFD0EC',
    },
    {
      title: 'Suggestion 2',
      suggestion: 'Suggestion rational Lorem Ipsum Long text',
      backgroundColor: '#FBD0FF',
    },
    {
      title: 'Suggestion 3',
      suggestion: 'Suggestion rational Lorem Ipsum Long text',
      backgroundColor: '#D0E0FF',
    },
    {
      title: 'Suggestion 4',
      suggestion: 'Suggestion rational Lorem Ipsum Long text',
      backgroundColor: '#D0F9FF',
    },
    {
      title: 'Suggestion 5',
      suggestion: 'Suggestion rational Lorem Ipsum Long text',
      backgroundColor: '#FFD0EC',
    }
  ],
};

const sampleCategory: AssistantSuggestionCategoryProps = {
  categoryTitle: 'Visualization Suggestions',
  categoryDescription: 'Suggested Alerts based on available data sources and data sets',
  backgroundGradientStart: '#FF9398',
  backgroundGradientEnd: '#FF4049',
  suggestions: sampleSuggestions.suggestions,
};

const sampleCategory2: AssistantSuggestionCategoryProps = {
  categoryTitle: 'Alert Suggestions',
  categoryDescription: 'Suggested Alerts based on available data sources and data sets',
  backgroundGradientStart: '#7572FF',
  backgroundGradientEnd: '#255ACF',
  suggestions: sampleSuggestions.suggestions,
};

const categories: AssistantCategoriesProps = {
  categories: [sampleCategory, sampleCategory2],
};

export interface AssistantProps {
  user: {
    userId: number;
    firstName: string;
    lastName: string;
  };
  mydata: string|null;
}


/**
 * This is the main page for the Assistant: Superset. This page will be the first page that the user sees when they open the Assistant.
 * @param props 
 * @returns 
 */


export function AssistantHome(props: AssistantProps) {
  return (
    <>
    <AssistantWelcomeMessage userFirsrName={props.user.firstName} />
    <AssistantSuggestionCategories {...categories} />
    <AssistantPrompt />
    </>
  );
};
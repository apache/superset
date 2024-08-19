import withToasts from 'src/components/MessageToasts/withToasts';
import SubMenu from 'src/features/home/SubMenu';
import { AssistantSuggestionsGridProps } from './AssistantSuggestionsGrid';
import { AssistantSuggestionCategoryProps} from './AssistantSuggestionCategory';
import { AssistantCategoriesProps, AssistantSuggestionCategories } from './AssistantSuggestionCategories';
import { AssistantWelcomeMessage } from './AssistantWelcomeMessage';
import { AssistantPrompt } from './AssistantPrompt';

interface AssistantProps {
  user: {
    userId: number;
    firstName: string;
    lastName: string;
  };
  mydata: string|null;
}

/**
 * title: string;
    suggestion: string;
    backgroundColor?: string;
 */

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

function Assistant(props: AssistantProps) {

  // This Component Serves as the Assistant's Home Page
  // Header Dispays the Users Name and Databases they have access to

  return (
   <>
    <SubMenu
      name="Assistant"
    />
    <AssistantWelcomeMessage userFirsrName={props.user.firstName} />
    <AssistantSuggestionCategories {...categories} />
    <AssistantPrompt />
   </>
  );
}

export default withToasts(Assistant);
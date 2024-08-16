import withToasts from 'src/components/MessageToasts/withToasts';
import SubMenu from 'src/features/home/SubMenu';
import { AssistantSuggestionsGridProps } from './AssistantSuggestionsGrid';
import { AssistantSuggestionCategory, AssistantSuggestionCategoryProps} from './AssistantSuggestionCategory';

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
  categoryTitle: 'Category Title',
  categoryDescription: 'Category Description',
  backgroundGradientStart: '#FF9398',
  backgroundGradientEnd: '#FF4049',
  suggestions: sampleSuggestions.suggestions,
};

function Assistant(props: AssistantProps) {

  // This Component Serves as the Assistant's Home Page
  // Header Dispays the Users Name and Databases they have access to

  return (
   <>
    <SubMenu
      name="Assistant"
    />
    <AssistantSuggestionCategory {...sampleCategory} />
   </>
  );
}

export default withToasts(Assistant);
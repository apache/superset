import React, { Component } from 'react';
import { AssistantSuggestionsGridProps } from './AssistantSuggestionsGrid';
import { AssistantSuggestionCategoryProps} from './AssistantSuggestionCategory';
import { AssistantCategoriesProps, AssistantSuggestionCategories } from './AssistantSuggestionCategories';
import { AssistantWelcomeMessage } from './AssistantWelcomeMessage';
import { AssistantPrompt } from './AssistantPrompt';
import { DatasourceProps } from '../ContextBuilder/Datasource';
import { getVizSuggestions } from '../assistantUtils';
import { AssistantSuggestionProps } from './AssistantSuggestion';



const sampleSuggestions: AssistantSuggestionsGridProps = {
  suggestions: [
  ],
};


const sampleCategory: AssistantSuggestionCategoryProps = {
  categoryTitle: 'Visualization Suggestions',
  categoryDescription: 'Suggested Alerts based on available data sources and data sets',
  backgroundGradientStart: '#FF9398',
  backgroundGradientEnd: '#FF4049',
  suggestions: sampleSuggestions.suggestions,
};

const testcategories: AssistantCategoriesProps = {
  categories: [sampleCategory],
};

export interface AssistantProps {
  user: {
    userId: number;
    firstName: string;
    lastName: string;
  };
  data: DatasourceProps[];
}

/**
 * This is the main page for the Assistant: Superset. This page will be the first page that the user sees when they open the Assistant.
 */
export class AssistantHome extends Component<AssistantProps> {
  

  // constructor
  constructor(props: AssistantProps) {
    super(props);
    this.state = {
      ...this.props,
      categories: {
        categories:[]
      },
    };
  }

  async componentDidUpdate(prevProps: AssistantProps){
    // console.log("Assistant Home Props: prev", prevProps.categories);
    // console.log("Assistant Home Props: current", this.props.categories);
    if(prevProps.data !== this.props.data){
      console.log("Fetching new suggestions");
      // 1.Understanding clinical data
      // 
      const purpose = `
        1. Understanding clinical data
        2. Identifying trends in patient data
        3. Predicting patient outcomes
        4. Identifying high-risk patients
        5. Understanding patient demographics
        6. Identifying patient cohorts
      `;
      let suggestions:AssistantSuggestionProps[] = []
      if (this.props.data.length > 0) {
        suggestions = await getVizSuggestions(this.props.data, purpose);
      }
      this.setState({
        data: this.props.data,
        categories: {
          categories: [
            {
              categoryTitle: 'Gemini Visualization Suggestions',
              categoryDescription: 'Suggested Alerts based on available data sources and data sets',
              backgroundGradientStart: '#FF9398',
              backgroundGradientEnd: '#FF4049',
              suggestions: suggestions,
            },
          ],
        },
      },()=>{
        console.log("New Suggestions", this.state.categories);
      });
    }

  }



  render() {
    const { user } = this.props;
    const { categories } = this.state;
    console.log("Assistant Home Props render", categories);

    return (
      <>
        <AssistantWelcomeMessage userFirsrName={user.firstName} />
        <AssistantSuggestionCategories {...categories} />
        <AssistantPrompt />
      </>
    );
  }
}

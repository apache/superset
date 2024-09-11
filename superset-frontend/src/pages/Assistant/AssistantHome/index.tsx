import React, { Component } from 'react';
import { AssistantCategoriesProps, AssistantSuggestionCategories } from './AssistantSuggestionCategories';
import { AssistantWelcomeMessage } from './AssistantWelcomeMessage';
import { AssistantPrompt } from './AssistantPrompt';
import { DatasourceProps } from '../ContextBuilder/Datasource';
import { getVizSuggestions, cleanDatasourceProps } from '../assistantUtils';
import { AssistantSuggestionProps } from './AssistantSuggestion';
import { AssistantActionsType } from '../actions';
import { flatten } from 'lodash';
import Loading from 'src/components/Loading';


export interface AssistantProps {
  user: {
    userId: number;
    firstName: string;
    lastName: string;
  };
  data: DatasourceProps[];
  actions: AssistantActionsType;
}

export interface AssistantState extends AssistantProps {
  categories: AssistantCategoriesProps;
  isLoadingSuggestions: boolean;
}

/**
 * This is the main page for the Assistant: Superset. This page will be the first page that the user sees when they open the Assistant.
 */
export class AssistantHome extends Component<AssistantProps, AssistantState> {

  timer: any;

  // constructor
  constructor(props: AssistantProps) {
    super(props);
    console.log("Assistant Home Props", props);
    this.state = {
      ...this.props,
      isLoadingSuggestions: false,
      categories: {
        categories: []
      },
    };
  }

  async componentDidUpdate(prevProps: AssistantProps) {
    console.log("Assistant Home Props: componentDidUpdate", this.props.data);
    // only fetch suggestions when the data changes and after set timeout
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(async () => {
      if (prevProps.data !== this.props.data) {
        this.setState({ isLoadingSuggestions: true });
        const cleaned = cleanDatasourceProps(this.props.data)
        console.log("Assistant Home Props: componentDidUpdate", cleaned)
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
        let suggestions: AssistantSuggestionProps[] = []
        if (this.props.data.length > 0) {
          suggestions = await getVizSuggestions(cleaned, purpose);
        }
        this.setState({
          data: this.props.data,
          isLoadingSuggestions: false,
          categories: {
            categories: [
              {
                categoryTitle: 'Visualization Suggestions',
                categoryDescription: 'Suggested Alerts based on available data sources and data sets',
                backgroundGradientStart: '#FF9398',
                backgroundGradientEnd: '#FF4049',
                suggestions: suggestions,
                actions: this.props.actions,
              },
            ],
          },
        }, () => {
          console.log("New Suggestions", this.state.categories);
        });
      }
    }, 1000);


  }

  componentDidMount() {
    console.log("Assistant Home Props: componentDidMount", this.props.data);
  }

  render() {
    const { user } = this.props;
    const { categories, isLoadingSuggestions } = this.state;
    console.log("Assistant Home Props render", categories);

    return (
      <>
        <AssistantWelcomeMessage userFirsrName={user.firstName} />

        { isLoadingSuggestions && <Loading/>}

        <AssistantSuggestionCategories {...categories} />
        <AssistantPrompt />
      </>
    );
  }
}

import { readableColor, adjustOpacity, executeQuery } from '../contextUtils';
import { getChartControlValues } from '../assistantUtils';
import { postFormData } from '../../../explore/exploreUtils/formData';
import { QueryResults } from '@superset-ui/core';
import { EXPLORE_CHART_DEFAULT } from '../../../SqlLab/types';
import { useHistory } from 'react-router-dom';
import { URL_PARAMS } from 'src/constants';
import { mountExploreUrl } from 'src/explore/exploreUtils';

/**
 * Component that displays the single suggestion for the assistant
 */

/**
 * Props
 */

export interface AssistantSuggestionProps {
    title: string;
    suggestion: string;
    backgroundColor?: string; // default color: white with .5 opacity
    databaseId?: string;
    schemaName?: string;
    viz_datasources: string[];
    viz_type: string;
    llm_optimized: string;
}

/**
 * AssistantSuggestion Component
 */
export function AssistantSuggestion(props: AssistantSuggestionProps | any) {

    // bg color ensure at most 50% opacity
    const bg = adjustOpacity(props.backgroundColor || '#FFFFFF', .8)
    const textColor = readableColor(bg)

    const history = useHistory()


    // click/tap handler
    const handleClick = async () => {
        console.log("Assistant Suggestion Props", props)
        // execute query
        const queryResult: QueryResults|null = await executeQuery(props.databaseId, props.schemaName, props.viz_datasources[0]);
        // postFormData
        if (!queryResult || !queryResult.results || !queryResult.results.query_id) {
            return;
        }

        const formData = await getChartControlValues( props.llm_optimized, props.viz_type, {
            sql: props.viz_datasources[0]
        });

        console.log('AssistantSuggestion formData:', formData)

        /**
         * {
                ...EXPLORE_CHART_DEFAULT,
                viz_type: props.viz_type,
                datasource: `${queryResult.results.query_id}__assistant_query`,
                all_columns: queryResult.results.selected_columns.map((c)=> c.column_name)
            }
         */
        console.log('AssistantSuggestion queryResult:', queryResult)
        const formDataKey = await postFormData(queryResult.results.query_id!, 'query',{
            ...EXPLORE_CHART_DEFAULT,
            ...formData,
            assistant_data: props.llm_optimized,
            viz_type: props.viz_type,
            ...{
                all_columns: queryResult.results.selected_columns.map((c)=> c.column_name)
            }
        });
        console.log('AssistantSuggestion formDataKey response:', formDataKey)
        const url = mountExploreUrl(null, {
            [URL_PARAMS.formDataKey.name]: formDataKey,
            [URL_PARAMS.datasourceId.name]: queryResult.results.query_id,
            [URL_PARAMS.datasourceType.name]: 'query'
          });
        console.log('AssistantSuggestion url:', url)
        history.push(url);
    };

    return (
        <div style={{
            backgroundColor: bg,
            padding: '8px',
            maxWidth: '250px',
            overflow: 'hidden',
            borderRadius: '5px'
        }} onClick={handleClick}>
            <h5 style={{
                whiteSpace: 'normal',
                wordWrap: 'break-word',
                color: textColor,
            }}>{props.title}</h5>
            <p style={{
                whiteSpace: 'normal',
                wordWrap: 'break-word',
                fontSize: '12px',
                color: textColor
            }}>{props.suggestion}</p>
        </div>
    );
}
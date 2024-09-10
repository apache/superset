import { DatasourceProps } from './Datasource';
import { ContextBuilderSteps } from './ContextBuilderSteps';
import { DatasourceSelector, DatasourceSelectorProps } from './DatasourceSelector';

export function AssistantContextBuilder(props: DatasourceSelectorProps) {

    console.log("AssistantContextBuilder Props", props);

    const handleDatasourceChange = (data: DatasourceProps[]) => {
        props.onChange(data);
    };

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'row',
            width: '100%',
            height: '100%',
        }}>
            <ContextBuilderSteps />

            <DatasourceSelector {...props} onChange={handleDatasourceChange} />
        </div>
    )
}
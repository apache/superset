import { DatasourceProps } from './Datasource';
import { ContextBuilderSteps } from './ContextBuilderSteps';
import { DatasourceSelector, DatasourceSelectorProps } from './DatasourceSelector';

export function AssistantContextBuilder(props: DatasourceSelectorProps) {

    console.log("AssistantContextBuilder Props", props);

    const handleDatasourceChange = (data: DatasourceProps[]) => {
        props.onChange(data);
    };

    return (
        // 2x1 grid
        <div style={{
            display: 'flex',
            flexDirection: 'row',
            width: 'fill-available',
        }}>
            <ContextBuilderSteps />
            
            <DatasourceSelector {...props} onChange={handleDatasourceChange} />
        </div>
    )
}
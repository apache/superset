import { DatasourceProps } from './Datasource';
import { ContextBuilderSteps } from './ContextBuilderSteps';
import { DatasourceSelector, DatasourceSelectorProps } from './DatasourceSelector';

export function AssistantContextBuilder(props: DatasourceSelectorProps) {

    const handleDatasourceChange = (data: DatasourceProps[]) => {
        console.log("<<<<>>>> Datasource Change:", JSON.stringify(data));
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
            
            <DatasourceSelector onChange={handleDatasourceChange} />
        </div>
    )
}
import { ContextBuilderSteps } from './ContextBuilderSteps';
import { DatasourceSelector } from './DatasourceSelector';




export function AssistantContextBuilder(props: any) {

    const handleDatasourceChange = (data: any) => {
        console.log("<<<<>>>> Datasource Change: ", data);
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
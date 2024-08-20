import { ContextBuilderSteps } from './ContextBuilderSteps';
import { DatasourceSelector } from './DatasourceSelector';




export function AssistantContextBuilder(props: any) {
    return (
        // 2x1 grid
        <div style={{
            display: 'flex',
            flexDirection: 'row',
            width: 'fill-available',
        }}>
            <ContextBuilderSteps />
            
            <DatasourceSelector />
        </div>
    )
}
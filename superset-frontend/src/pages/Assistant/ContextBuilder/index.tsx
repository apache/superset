import { ContextBuilderSteps } from './ContextBuilderSteps';
import {DatabaseSelector } from './DatabaseSelector';




export function AssistantContextBuilder(props: any) {
    return (
        // 2x1 grid
        <div style={{
            display: 'flex',
            flexDirection: 'row',
            width: 'fill-available',
        }}>
            <ContextBuilderSteps />
            <DatabaseSelector />
        </div>
    )
}
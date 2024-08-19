

export interface ContextBuilderStepProp{
    step: string;
    description: string;
}

export function ContextBuilderStep(props: ContextBuilderStepProp) {
    return (
        <div style={{
            paddingTop: '20px',
        }}>
        <h5>{props.step}</h5>
        <p>{props.description}</p>
        </div>
    )
}
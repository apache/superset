import { ContextBuilderStep, ContextBuilderStepProp } from './ContextBuilderStep';
import { readableColor } from 'polished';

interface ContextBuilderProps {
    title: string;
    suggestion: string;
    steps: ContextBuilderStepProp[];
}

export const testProps: ContextBuilderProps = {
    title: 'Suggestion 1',
    suggestion: 'Suggestion rational Lorem Ipsum Long text',
    steps: [
        {
            step: 'Step 1',
            description: 'Step 1 Description'
        },
        {
            step: 'Step 2',
            description: 'Step 2 Description'
        },
        {
            step: 'Step 3',
            description: 'Step 3 Description'
        }
    ]
}

export function ContextBuilderSteps(props: any) {
    const bg = readableColor('#0E3873')
    return (
        <>
            <div style={{
                background: 'radial-gradient(circle, #103F91 0%, #0E3873 100%)',
                borderTopLeftRadius: '16px',
                borderBottomLeftRadius: '16px',
                width: 'fit-content',
                minWidth: '300px',
                height: 'fill-available',
            }}>

                <div style={{
                    padding: '24px',
                    color: bg,
                }}>
                    <h3>Context Builder</h3>
                    <p>Lets give the assistant some data to crunch</p>
                    <br></br>
                    {testProps.steps.map((step, index) => {
                        return (
                            <ContextBuilderStep {...step} />
                        )
                    })}
                </div>

                <img style={{
                    position: 'relative',
                    bottom: '10px',
                    left: '10px',
                    width: '80px',

                }} src='/static/assets/images/assistant_logo_blurred.svg' />

            </div>

        </>
    )
}
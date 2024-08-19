/**
 * Props
 */
interface ContextSelectionProps {
    numDataSources: number;
    numTables: number;
    numColumns: number;
}

/**
 * Test Data
 */
const testProps: ContextSelectionProps = {
    numDataSources: 5,
    numTables: 10,
    numColumns: 20
}

/**
 * ContextSelection Component
 */

export function ContextSelection() {
    const props: ContextSelectionProps = testProps;
    return (
        <div style={{
            position: 'relative',
            bottom: '0',
        }}>
            <div style={{
                display: 'flex',
                flexDirection: 'row',
                gap: '10px',
                alignItems: 'center',
                justifyContent: 'right',
                padding: '10px',
                background: '#f0f0f0',
                borderRadius: '16px',
            }}>
                <div style={{
                    display: 'flex',
                    flexDirection: 'row',
                    gap: '5px',
                }}>
                    <span>{props.numDataSources} Data Sources,</span>
                    <span>{props.numTables} Tables,</span>
                    <span>{props.numColumns} Columns.</span>
                </div>
                {/* Cancel Confirm */}
                <div style={{
                    display: 'flex',
                    flexDirection: 'row',
                    gap: '10px',
                }}>
                    <button style={{
                        padding: '10px',
                        borderRadius: '8px',
                        background: '#95C9E7',
                        color: '#006FAF',
                        border: 'none',
                    }} >Cancel</button>
                    <button style={{
                        padding: '10px',
                        borderRadius: '8px',
                        background: '#DEDEDE',
                        color: 'black',
                        border: 'none',
                    }} >Confirm</button>
                </div>
            </div>
        </div>
    );
}
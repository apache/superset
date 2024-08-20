/**
 * Props
 */
interface ContextSelectionProps {
    numDataSources: number;
    numSchemas: number;
    numTables: number;
    numColumns: number;
}

/**
 * Test Data
 */
const testProps: ContextSelectionProps = {
    numDataSources: 5,
    numSchemas: 15,
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
                    <span>{props.numSchemas} Schemas,</span>
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
                        borderRadius: '4px',
                        background: '#95C9E7',
                        color: '#006FAF',
                        border: 'none',
                        width: '100px',
                        fontSize: '16px',
                    }} >Cancel</button>
                    <button style={{
                        padding: '10px',
                        borderRadius: '4px',
                        background: '#DEDEDE',
                        color: 'black',
                        border: 'none',
                        width: '100px',
                        fontSize: '16px',
                    }} >Confirm</button>
                </div>
            </div>
        </div>
    );
}
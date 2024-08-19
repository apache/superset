import { Input } from 'antd'

const { TextArea } = Input;

export function AssistantPrompt() {
    return (

        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '5px',
            padding: '10px',
            width: '100%',
            height: 'auto',
        }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'white',
                borderRadius: '30px',
                border: '1px solid #e3e3e3',
                width: 'fill-content',
                height: 'auto',
                padding: '10px',
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    position: 'relative',
                    width: 'fill-content',
                    height: 'auto',
                }}>

                    <TextArea 
                        placeholder="Tell the assistant what you want to visualize" 
                        style={{
                            minWidth: '400px',
                            border: 'none',
                            outline: 'none',
                            borderRadius: '30px',
                        }}
                        autoSize={{
                            minRows: 3,
                            maxRows: 10
                        }}
                    />

                    <span style={{
                        position: 'absolute',
                        right: '15px',
                        cursor: 'pointer',
                        fontSize: '20px',

                    }}>📎</span>


                </div>

                <button style={{
                    padding: '10px',
                    background: `linear-gradient(90deg, #7472FF 0%, #265AD0 100%)`,
                    color: 'white',
                    border: 'none',
                    // 50% height radius
                    borderRadius: '50px',
                    cursor: 'pointer',
                }}>
                    <span style={{
                        height: '40px',
                        width: '40px',
                        color: 'white',
                        borderRadius: '50%',
                    }}>
                        <img src='/static/assets/images/assistant_prompt_send.svg' />
                    </span> &nbsp;
                    Visualize</button>
            </div>
        </div>
    )
}
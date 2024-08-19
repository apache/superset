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
                <TextArea
                    placeholder="Tell the assistant what you want to visualize"
                    style={{
                        minWidth: '500px',
                        border: 'none',
                        outline: 'none',
                        borderRadius: '20px',
                    }}
                    autoSize={{
                        minRows: 3,
                        maxRows: 10
                    }}
                />
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        alignContent: 'center',
                        justifyContent: 'center',
                        position: 'relative',
                        bottom: '0',
                        right: '0',
                        width: 'fill-content',
                        height: 'fill-content',
                    }}>
                    <span style={{
                        cursor: 'pointer',
                        height: '40px',
                        width: '40px',
                        alignContent: 'center',
                        alignItems: 'center',
                    }}>
                        <img src='/static/assets/images/assistant_prompt_attachment.svg' alt='Attachment' />
                    </span>

                    <button style={{
                        padding: '10px',
                        background: `linear-gradient(90deg, #7472FF 0%, #265AD0 100%)`,
                        color: 'white',
                        border: 'none',
                        borderRadius: '50px',
                        cursor: 'pointer',
                        width: 'fill-content',
                        display: 'flex',
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        alignContent: 'center',
                    }}>
                        <span style={{
                            height: '40px',
                            width: '40px',
                            color: 'white',
                            alignContent: 'center',
                            alignItems: 'center',
                        }}>
                            <img src='/static/assets/images/assistant_prompt_send.svg' alt='v_logo' />
                        </span> &nbsp;Visualize&nbsp;
                    </button>
                </div>

            </div>

        </div>
    )
}

export interface AssistantWelcomeMessageProps {
    userFirsrName?: string
}

export function AssistantWelcomeMessage(props: AssistantWelcomeMessageProps) {

    const name = props.userFirsrName || 'User';
    const upperCaseName = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
    return (
        <div style={{
            width: '100%',
            display: 'flex',
            justifyContent: 'center',
            alignContent: 'center',
            alignItems: 'center',
            flex: 'wrap',
            flexDirection: 'column',
            gap: '10px',
            padding: '10px',
        }} >
            <img src="/static/assets/images/assistant_logo_1.svg" />
            <h3>Welcome to the Assistant, {upperCaseName}!</h3>
            <p>Here are some suggestions to get you started:</p>
        </div>
    )

}
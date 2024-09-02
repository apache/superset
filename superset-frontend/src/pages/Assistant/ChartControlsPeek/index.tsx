import { Modal } from "antd";
import { saveChartExample } from "../assistantUtils";
import { useState } from "react";
import { useDispatch } from "react-redux";
import { QueryFormData } from "@superset-ui/core";
import { set } from "lodash";


function ChartControlsPeek(props: any) {
    const dispatch = useDispatch();

    console.log('ChartControlsPeek => props:', props)

    // ia open state
    const [isOpen, setIsOpen] = useState(true);
    const [formDataLcl, setFormDataLcl] = useState(props.form_data);

    const handleSaveExample = () => {
        console.log('ChartControlsPeek => handleSaveExample => To be removed')
        const { controls, form_data } = props;
        const cleaned_controls = {
            ...controls
        }
        delete cleaned_controls.datasource.user
    };

    const handleUpdateData = () => {
        const { setExploreControls } = props.actions
        console.log('ChartControlsPeek => handleUpdateData => props:', setExploreControls)
        setExploreControls(formDataLcl);
    };

    const handleClose = () => {
        setIsOpen(false);
    };

    const handleOpen = () => {
        setIsOpen(true);
    }

    const handleTextareaChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        const textareaValue = event.target.value;
        try {
            const formQuery: QueryFormData = JSON.parse(textareaValue);
            // Do something with the formQuery object
            console.log('FormQuery:', formQuery);
            setFormDataLcl(formQuery);
        } catch (error) {
            console.error('Invalid JSON format');
        }
    };

    return (
        <div style={{
            position: 'fixed',
            bottom: '20px',
            left: '20px',
            zIndex: 9999
        }}>

            <Modal
                title="Form Data Values"
                visible={isOpen}
                onOk={handleUpdateData}
                okText="Update Data"
                onCancel={handleClose}
                cancelText="Close"
                width="80%"
            >
                <textarea
                    value={JSON.stringify(formDataLcl, null, 2)}
                    onChange={handleTextareaChange} // Add the textarea change handler
                    style={{
                        width: '100%',
                        height: 'auto',
                        minHeight: '400px',
                        marginTop: '10px'
                    }}
                />
            </Modal>

            <button onClick={handleOpen}>Peek Form Data</button>
        </div>
    )
}

export default ChartControlsPeek;
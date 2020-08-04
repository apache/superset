import * as React from 'react';

declare namespace FormControlFeedback {
    export interface FormControlFeedbackProps extends React.HTMLProps<FormControlFeedback> {
        bsClass?: string;
    }
}
declare class FormControlFeedback extends React.Component<FormControlFeedback.FormControlFeedbackProps> { }
export = FormControlFeedback;

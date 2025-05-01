import { t } from "@superset-ui/core";
import Field from "./Field";
import TextAreaControl from "src/explore/components/controls/TextAreaControl";
import Button from "../Button";
import { Icons } from "../Icons";

interface SqlFieldEditorProps {
    isEditMode: boolean;
    sqlTooltipOptions:string;
    onQueryRun: () => void;
    
}
//This component does not work yet, it is a work in progress
export default function SqlFieldEditor({
    isEditMode,sqlTooltipOptions, onQueryRun
}: SqlFieldEditorProps) {
    
    return (<Field
        inline={false}
        fieldKey="sql"
        label={t('SQL')}
        description={t(
            'When specifying SQL, the datasource acts as a view. ' +
            'Superset will use this statement as a subquery while grouping and filtering ' +
            'on the generated parent queries.'
        )}
        control={<TextAreaControl
            language="sql"
            offerEditInModal={false}
            minLines={10}
            maxLines={Infinity}
            readOnly={!isEditMode}
            resize="both"
            tooltipOptions={sqlTooltipOptions} />}

        additionalControl={<div css={{
            position: 'absolute',
            right: 0,
            top: 0,
            zIndex: 2
            }}>
                <Button css={{
                    alignSelf: 'flex-end',
                    height: 24,
                    paddingLeft: 6,
                    paddingRight: 6,
                }} size='small' buttonStyle='primary' onClick={() => {
                    onQueryRun();
                } }>
                    <Icons.CaretRightFilled iconSize="s"
                        css={theme => ({
                            color: theme.colors.grayscale.light5,
                        })} />
                </Button>
            </div>} 
        compact={false}/>)
}
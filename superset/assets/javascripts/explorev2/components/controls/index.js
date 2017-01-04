import CheckboxField from './CheckboxField';
import SelectField from './SelectField';
import TextAreaField from './TextAreaField';
import TextField from './TextField';
import Filters from './Filters';

const fields = [
  CheckboxField,
  SelectField,
  TextAreaField,
  TextField,
  Filters,
];

const fieldMap = {};
fields.forEach(field => {
  fieldMap[field.name] = field;
});
export default fieldMap;

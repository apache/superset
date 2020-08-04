import secret from 'prop-types/lib/ReactPropTypesSecret';

export default function callValidator(
  validator,
  { props },
  propName = '',
  componentName = '',
  location = '',
  propFullName = '',
) {
  return validator(
    props,
    propName,
    componentName,
    location,
    propFullName,
    secret,
  );
}

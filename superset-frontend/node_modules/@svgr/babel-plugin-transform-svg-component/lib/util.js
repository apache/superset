"use strict";

exports.__esModule = true;
exports.getExport = exports.getImport = exports.getInterface = exports.getProps = void 0;

function _extends() { _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends.apply(this, arguments); }

function typeAnnotation(typeAnnotation) {
  return {
    type: 'TypeAnnotation',
    typeAnnotation
  };
}

function genericTypeAnnotation(id, typeParameters = null) {
  return {
    type: 'GenericTypeAnnotation',
    id,
    typeParameters
  };
}

function typeParameters(params) {
  return {
    type: 'TypeParameterInstantiation',
    params
  };
}

function qualifiedTypeIdentifier(qualification, id) {
  return {
    type: 'QualifiedTypeIdentifier',
    qualification,
    id
  };
}

function intersectionTypeAnnotation(types) {
  return {
    type: 'IntersectionTypeAnnotation',
    types
  };
}

function interfaceDeclaration(id, body) {
  return {
    type: 'InterfaceDeclaration',
    id,
    typeParameters: null,
    extends: [],
    implements: [],
    mixins: [],
    body
  };
}

function objectTypeAnnotation(properties) {
  return {
    type: 'ObjectTypeAnnotation',
    properties
  };
}

function objectTypeProperty(key, value, optional = false) {
  return {
    type: 'ObjectTypeProperty',
    key,
    static: false,
    proto: false,
    kind: 'init',
    method: false,
    value,
    variance: null,
    optional
  };
}

function addTypeAnotation(obj, typeAnnotation, opts) {
  if (!opts.typescript) return obj;
  return _extends({}, obj, {
    typeAnnotation
  });
}

function getSvgPropsTypeAnnotation(t) {
  return genericTypeAnnotation(qualifiedTypeIdentifier(t.identifier('React'), t.identifier('SVGProps')), typeParameters([genericTypeAnnotation(t.identifier('SVGSVGElement'))]));
}

const getProps = ({
  types: t
}, opts) => {
  const props = [];

  if (opts.titleProp) {
    props.push(t.objectProperty(t.identifier('title'), t.identifier('title'), false, true));
    props.push(t.objectProperty(t.identifier('titleId'), t.identifier('titleId'), false, true));
  }

  if (opts.expandProps && props.length > 0) {
    props.push(t.restElement(t.identifier('props')));
  }

  const propsArgument = props.length > 0 ? t.objectPattern(props) : t.identifier('props');
  let propsTypeAnnotation;

  if (props.length > 0) {
    propsTypeAnnotation = genericTypeAnnotation(t.identifier('SVGRProps'));

    if (opts.expandProps) {
      propsTypeAnnotation = intersectionTypeAnnotation([getSvgPropsTypeAnnotation(t), propsTypeAnnotation]);
    }
  } else {
    propsTypeAnnotation = opts.expandProps ? getSvgPropsTypeAnnotation(t) : t.objectPattern([]);
  }

  const typedPropsArgument = addTypeAnotation(propsArgument, typeAnnotation(propsTypeAnnotation), opts);
  const args = [];
  if (opts.expandProps || props.length > 0 || opts.ref) args.push(typedPropsArgument);

  if (opts.ref) {
    const refArgument = t.identifier(opts.typescript ? 'svgRef?' : 'svgRef');
    const typedRefArgument = addTypeAnotation(refArgument, typeAnnotation(genericTypeAnnotation(qualifiedTypeIdentifier(t.identifier('React'), t.identifier('Ref')), typeParameters([genericTypeAnnotation(t.identifier('SVGSVGElement'))]))), opts);
    args.push(typedRefArgument);
  }

  return args;
};

exports.getProps = getProps;

const getInterface = ({
  types: t
}, opts) => {
  if (!opts.typescript) return null;
  const properties = [];

  if (opts.titleProp) {
    properties.push(objectTypeProperty(t.identifier('title'), t.identifier('string'), true));
    properties.push(objectTypeProperty(t.identifier('titleId'), t.identifier('string'), true));
  }

  if (properties.length === 0) return null;
  return interfaceDeclaration(t.identifier('SVGRProps'), objectTypeAnnotation(properties));
};

exports.getInterface = getInterface;

const getImport = ({
  types: t
}, opts) => {
  const importDeclarations = [t.importDeclaration([t.importNamespaceSpecifier(t.identifier('React'))], t.stringLiteral('react'))];

  if (opts.native) {
    if (opts.native.expo) {
      importDeclarations.push(t.importDeclaration([], t.stringLiteral('expo')));
    } else {
      importDeclarations.push(t.importDeclaration([t.importDefaultSpecifier(t.identifier('Svg'))], t.stringLiteral('react-native-svg')));
    }
  }

  return importDeclarations;
};

exports.getImport = getImport;

const getExport = ({
  template
}, opts) => {
  let result = '';
  let exportName = opts.state.componentName;
  const plugins = ['jsx'];

  if (opts.typescript) {
    plugins.push('typescript');
  }

  if (opts.ref) {
    const nextExportName = `ForwardRef`;
    result += `const ${nextExportName} = React.forwardRef(${exportName})\n\n`;
    exportName = nextExportName;
  }

  if (opts.memo) {
    const nextExportName = `Memo${exportName}`;
    result += `const ${nextExportName} = React.memo(${exportName})\n\n`;
    exportName = nextExportName;
  }

  if (opts.state.caller && opts.state.caller.previousExport) {
    result += `${opts.state.caller.previousExport}\n`;
    result += `export { ${exportName} as ReactComponent }`;
    return template.ast(result, {
      plugins
    });
  }

  result += `export default ${exportName}`;
  return template.ast(result, {
    plugins
  });
};

exports.getExport = getExport;
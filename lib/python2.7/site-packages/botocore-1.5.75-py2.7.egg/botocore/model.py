# Copyright 2015 Amazon.com, Inc. or its affiliates. All Rights Reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License"). You
# may not use this file except in compliance with the License. A copy of
# the License is located at
#
# http://aws.amazon.com/apache2.0/
#
# or in the "license" file accompanying this file. This file is
# distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF
# ANY KIND, either express or implied. See the License for the specific
# language governing permissions and limitations under the License.
"""Abstractions to interact with service models."""
from collections import defaultdict

from botocore.utils import CachedProperty, instance_cache
from botocore.compat import OrderedDict


NOT_SET = object()


class NoShapeFoundError(Exception):
    pass


class InvalidShapeError(Exception):
    pass


class OperationNotFoundError(Exception):
    pass


class InvalidShapeReferenceError(Exception):
    pass


class UndefinedModelAttributeError(Exception):
    pass


class Shape(object):
    """Object representing a shape from the service model."""
    # To simplify serialization logic, all shape params that are
    # related to serialization are moved from the top level hash into
    # a 'serialization' hash.  This list below contains the names of all
    # the attributes that should be moved.
    SERIALIZED_ATTRS = ['locationName', 'queryName', 'flattened', 'location',
                        'payload', 'streaming', 'timestampFormat',
                        'xmlNamespace', 'resultWrapper', 'xmlAttribute',
                        'jsonvalue']
    METADATA_ATTRS = ['required', 'min', 'max', 'sensitive', 'enum',
                      'idempotencyToken', 'error', 'exception']
    MAP_TYPE = OrderedDict

    def __init__(self, shape_name, shape_model, shape_resolver=None):
        """

        :type shape_name: string
        :param shape_name: The name of the shape.

        :type shape_model: dict
        :param shape_model: The shape model.  This would be the value
            associated with the key in the "shapes" dict of the
            service model (i.e ``model['shapes'][shape_name]``)

        :type shape_resolver: botocore.model.ShapeResolver
        :param shape_resolver: A shape resolver object.  This is used to
            resolve references to other shapes.  For scalar shape types
            (string, integer, boolean, etc.), this argument is not
            required.  If a shape_resolver is not provided for a complex
            type, then a ``ValueError`` will be raised when an attempt
            to resolve a shape is made.

        """
        self.name = shape_name
        self.type_name = shape_model['type']
        self.documentation = shape_model.get('documentation', '')
        self._shape_model = shape_model
        if shape_resolver is None:
            # If a shape_resolver is not provided, we create an object
            # that will throw errors if you attempt to resolve
            # a shape.  This is actually ok for scalar shapes
            # because they don't need to resolve shapes and shouldn't
            # be required to provide an object they won't use.
            shape_resolver = UnresolvableShapeMap()
        self._shape_resolver = shape_resolver
        self._cache = {}

    @CachedProperty
    def serialization(self):
        """Serialization information about the shape.

        This contains information that may be needed for input serialization
        or response parsing.  This can include:

            * name
            * queryName
            * flattened
            * location
            * payload
            * streaming
            * xmlNamespace
            * resultWrapper
            * xmlAttribute
            * jsonvalue

        :rtype: dict
        :return: Serialization information about the shape.

        """
        model = self._shape_model
        serialization = {}
        for attr in self.SERIALIZED_ATTRS:
            if attr in self._shape_model:
                serialization[attr] = model[attr]
        # For consistency, locationName is renamed to just 'name'.
        if 'locationName' in serialization:
            serialization['name'] = serialization.pop('locationName')
        return serialization

    @CachedProperty
    def metadata(self):
        """Metadata about the shape.

        This requires optional information about the shape, including:

            * min
            * max
            * enum
            * sensitive
            * required
            * idempotencyToken

        :rtype: dict
        :return: Metadata about the shape.

        """
        model = self._shape_model
        metadata = {}
        for attr in self.METADATA_ATTRS:
            if attr in self._shape_model:
                metadata[attr] = model[attr]
        return metadata

    @CachedProperty
    def required_members(self):
        """A list of members that are required.

        A structure shape can define members that are required.
        This value will return a list of required members.  If there
        are no required members an empty list is returned.

        """
        return self.metadata.get('required', [])

    def _resolve_shape_ref(self, shape_ref):
        return self._shape_resolver.resolve_shape_ref(shape_ref)

    def __repr__(self):
        return "<%s(%s)>" % (self.__class__.__name__,
                             self.name)


class StructureShape(Shape):
    @CachedProperty
    def members(self):
        members = self._shape_model['members']
        # The members dict looks like:
        #    'members': {
        #        'MemberName': {'shape': 'shapeName'},
        #        'MemberName2': {'shape': 'shapeName'},
        #    }
        # We return a dict of member name to Shape object.
        shape_members = self.MAP_TYPE()
        for name, shape_ref in members.items():
            shape_members[name] = self._resolve_shape_ref(shape_ref)
        return shape_members


class ListShape(Shape):
    @CachedProperty
    def member(self):
        return self._resolve_shape_ref(self._shape_model['member'])


class MapShape(Shape):
    @CachedProperty
    def key(self):
        return self._resolve_shape_ref(self._shape_model['key'])

    @CachedProperty
    def value(self):
        return self._resolve_shape_ref(self._shape_model['value'])


class StringShape(Shape):
    @CachedProperty
    def enum(self):
        return self.metadata.get('enum', [])


class ServiceModel(object):
    """

    :ivar service_description: The parsed service description dictionary.

    """

    def __init__(self, service_description, service_name=None):
        """

        :type service_description: dict
        :param service_description: The service description model.  This value
            is obtained from a botocore.loader.Loader, or from directly loading
            the file yourself::

                service_description = json.load(
                    open('/path/to/service-description-model.json'))
                model = ServiceModel(service_description)

        :type service_name: str
        :param service_name: The name of the service.  Normally this is
            the endpoint prefix defined in the service_description.  However,
            you can override this value to provide a more convenient name.
            This is done in a few places in botocore (ses instead of email,
            emr instead of elasticmapreduce).  If this value is not provided,
            it will default to the endpointPrefix defined in the model.

        """
        self._service_description = service_description
        # We want clients to be able to access metadata directly.
        self.metadata = service_description.get('metadata', {})
        self._shape_resolver = ShapeResolver(
            service_description.get('shapes', {}))
        self._signature_version = NOT_SET
        self._service_name = service_name
        self._instance_cache = {}

    def shape_for(self, shape_name, member_traits=None):
        return self._shape_resolver.get_shape_by_name(
            shape_name, member_traits)

    def resolve_shape_ref(self, shape_ref):
        return self._shape_resolver.resolve_shape_ref(shape_ref)

    @CachedProperty
    def shape_names(self):
        return list(self._service_description.get('shapes', {}))

    @instance_cache
    def operation_model(self, operation_name):
        try:
            model = self._service_description['operations'][operation_name]
        except KeyError:
            raise OperationNotFoundError(operation_name)
        return OperationModel(model, self, operation_name)

    @CachedProperty
    def documentation(self):
        return self._service_description.get('documentation', '')

    @CachedProperty
    def operation_names(self):
        return list(self._service_description.get('operations', []))

    @CachedProperty
    def service_name(self):
        """The name of the service.

        This defaults to the endpointPrefix defined in the service model.
        However, this value can be overriden when a ``ServiceModel`` is
        created.  If a service_name was not provided when the ``ServiceModel``
        was created and if there is no endpointPrefix defined in the
        service model, then an ``UndefinedModelAttributeError`` exception
        will be raised.

        """
        if self._service_name is not None:
            return self._service_name
        else:
            return self.endpoint_prefix

    @CachedProperty
    def signing_name(self):
        """The name to use when computing signatures.

        If the model does not define a signing name, this
        value will be the endpoint prefix defined in the model.
        """
        signing_name = self.metadata.get('signingName')
        if signing_name is None:
            signing_name = self.endpoint_prefix
        return signing_name

    @CachedProperty
    def api_version(self):
        return self._get_metadata_property('apiVersion')

    @CachedProperty
    def protocol(self):
        return self._get_metadata_property('protocol')

    @CachedProperty
    def endpoint_prefix(self):
        return self._get_metadata_property('endpointPrefix')

    def _get_metadata_property(self, name):
        try:
            return self.metadata[name]
        except KeyError:
            raise UndefinedModelAttributeError(
                '"%s" not defined in the metadata of the the model: %s' %
                (name, self))

    # Signature version is one of the rare properties
    # than can be modified so a CachedProperty is not used here.

    @property
    def signature_version(self):
        if self._signature_version is NOT_SET:
            signature_version = self.metadata.get('signatureVersion')
            self._signature_version = signature_version
        return self._signature_version

    @signature_version.setter
    def signature_version(self, value):
        self._signature_version = value


class OperationModel(object):
    def __init__(self, operation_model, service_model, name=None):
        """

        :type operation_model: dict
        :param operation_model: The operation model.  This comes from the
            service model, and is the value associated with the operation
            name in the service model (i.e ``model['operations'][op_name]``).

        :type service_model: botocore.model.ServiceModel
        :param service_model: The service model associated with the operation.

        :type name: string
        :param name: The operation name.  This is the operation name exposed to
            the users of this model.  This can potentially be different from
            the "wire_name", which is the operation name that *must* by
            provided over the wire.  For example, given::

               "CreateCloudFrontOriginAccessIdentity":{
                 "name":"CreateCloudFrontOriginAccessIdentity2014_11_06",
                  ...
              }

           The ``name`` would be ``CreateCloudFrontOriginAccessIdentity``,
           but the ``self.wire_name`` would be
           ``CreateCloudFrontOriginAccessIdentity2014_11_06``, which is the
           value we must send in the corresponding HTTP request.

        """
        self._operation_model = operation_model
        self._service_model = service_model
        self._api_name = name
        # Clients can access '.name' to get the operation name
        # and '.metadata' to get the top level metdata of the service.
        self._wire_name = operation_model.get('name')
        self.metadata = service_model.metadata
        self.http = operation_model.get('http', {})

    @CachedProperty
    def name(self):
        if self._api_name is not None:
            return self._api_name
        else:
            return self.wire_name

    @property
    def wire_name(self):
        """The wire name of the operation.

        In many situations this is the same value as the
        ``name``, value, but in some services, the operation name
        exposed to the user is different from the operaiton name
        we send across the wire (e.g cloudfront).

        Any serialization code should use ``wire_name``.

        """
        return self._operation_model.get('name')

    @property
    def service_model(self):
        return self._service_model

    @CachedProperty
    def documentation(self):
        return self._operation_model.get('documentation', '')

    @CachedProperty
    def input_shape(self):
        if 'input' not in self._operation_model:
            # Some operations do not accept any input and do not define an
            # input shape.
            return None
        return self._service_model.resolve_shape_ref(
            self._operation_model['input'])

    @CachedProperty
    def output_shape(self):
        if 'output' not in self._operation_model:
            # Some operations do not define an output shape,
            # in which case we return None to indicate the
            # operation has no expected output.
            return None
        return self._service_model.resolve_shape_ref(
            self._operation_model['output'])

    @CachedProperty
    def idempotent_members(self):
        input_shape = self.input_shape
        if not input_shape:
            return []

        return [name for (name, shape) in input_shape.members.items()
                if 'idempotencyToken' in shape.metadata and
                shape.metadata['idempotencyToken']]

    @CachedProperty
    def auth_type(self):
        return self._operation_model.get('authtype')

    @CachedProperty
    def error_shapes(self):
        shapes = self._operation_model.get("errors", [])
        return list(self._service_model.resolve_shape_ref(s) for s in shapes)

    @CachedProperty
    def has_streaming_input(self):
        return self.get_streaming_input() is not None

    @CachedProperty
    def has_streaming_output(self):
        return self.get_streaming_output() is not None

    def get_streaming_input(self):
        return self._get_streaming_body(self.input_shape)

    def get_streaming_output(self):
        return self._get_streaming_body(self.output_shape)

    def _get_streaming_body(self, shape):
        """Returns the streaming member's shape if any; or None otherwise."""
        if shape is None:
            return None
        payload = shape.serialization.get('payload')
        if payload is not None:
            payload_shape = shape.members[payload]
            if payload_shape.type_name == 'blob':
                return payload_shape
        return None

    def __repr__(self):
        return '%s(name=%s)' % (self.__class__.__name__, self.name)


class ShapeResolver(object):
    """Resolves shape references."""

    # Any type not in this mapping will default to the Shape class.
    SHAPE_CLASSES = {
        'structure': StructureShape,
        'list': ListShape,
        'map': MapShape,
        'string': StringShape
    }

    def __init__(self, shape_map):
        self._shape_map = shape_map
        self._shape_cache = {}

    def get_shape_by_name(self, shape_name, member_traits=None):
        try:
            shape_model = self._shape_map[shape_name]
        except KeyError:
            raise NoShapeFoundError(shape_name)
        try:
            shape_cls = self.SHAPE_CLASSES.get(shape_model['type'], Shape)
        except KeyError:
            raise InvalidShapeError("Shape is missing required key 'type': %s"
                                    % shape_model)
        if member_traits:
            shape_model = shape_model.copy()
            shape_model.update(member_traits)
        result = shape_cls(shape_name, shape_model, self)
        return result

    def resolve_shape_ref(self, shape_ref):
        # A shape_ref is a dict that has a 'shape' key that
        # refers to a shape name as well as any additional
        # member traits that are then merged over the shape
        # definition.  For example:
        # {"shape": "StringType", "locationName": "Foobar"}
        if len(shape_ref) == 1 and 'shape' in shape_ref:
            # It's just a shape ref with no member traits, we can avoid
            # a .copy().  This is the common case so it's specifically
            # called out here.
            return self.get_shape_by_name(shape_ref['shape'])
        else:
            member_traits = shape_ref.copy()
            try:
                shape_name = member_traits.pop('shape')
            except KeyError:
                raise InvalidShapeReferenceError(
                    "Invalid model, missing shape reference: %s" % shape_ref)
            return self.get_shape_by_name(shape_name, member_traits)


class UnresolvableShapeMap(object):
    """A ShapeResolver that will throw ValueErrors when shapes are resolved.
    """
    def get_shape_by_name(self, shape_name, member_traits=None):
        raise ValueError("Attempted to lookup shape '%s', but no shape "
                         "map was provided.")

    def resolve_shape_ref(self, shape_ref):
        raise ValueError("Attempted to resolve shape '%s', but no shape "
                         "map was provided.")


class DenormalizedStructureBuilder(object):
    """Build a StructureShape from a denormalized model.

    This is a convenience builder class that makes it easy to construct
    ``StructureShape``s based on a denormalized model.

    It will handle the details of creating unique shape names and creating
    the appropriate shape map needed by the ``StructureShape`` class.

    Example usage::

        builder = DenormalizedStructureBuilder()
        shape = builder.with_members({
            'A': {
                'type': 'structure',
                'members': {
                    'B': {
                        'type': 'structure',
                        'members': {
                            'C': {
                                'type': 'string',
                            }
                        }
                    }
                }
            }
        }).build_model()
        # ``shape`` is now an instance of botocore.model.StructureShape

    :type dict_type: class
    :param dict_type: The dictionary type to use, allowing you to opt-in
                      to using OrderedDict or another dict type. This can
                      be particularly useful for testing when order
                      matters, such as for documentation.

    """
    def __init__(self, name=None):
        self.members = OrderedDict()
        self._name_generator = ShapeNameGenerator()
        if name is None:
            self.name = self._name_generator.new_shape_name('structure')

    def with_members(self, members):
        """

        :type members: dict
        :param members: The denormalized members.

        :return: self

        """
        self._members = members
        return self

    def build_model(self):
        """Build the model based on the provided members.

        :rtype: botocore.model.StructureShape
        :return: The built StructureShape object.

        """
        shapes = OrderedDict()
        denormalized = {
            'type': 'structure',
            'members': self._members,
        }
        self._build_model(denormalized, shapes, self.name)
        resolver = ShapeResolver(shape_map=shapes)
        return StructureShape(shape_name=self.name,
                              shape_model=shapes[self.name],
                              shape_resolver=resolver)

    def _build_model(self, model, shapes, shape_name):
        if model['type'] == 'structure':
            shapes[shape_name] = self._build_structure(model, shapes)
        elif model['type'] == 'list':
            shapes[shape_name] = self._build_list(model, shapes)
        elif model['type'] == 'map':
            shapes[shape_name] = self._build_map(model, shapes)
        elif model['type'] in ['string', 'integer', 'boolean', 'blob', 'float',
                               'timestamp', 'long', 'double', 'char']:
            shapes[shape_name] = self._build_scalar(model)
        else:
            raise InvalidShapeError("Unknown shape type: %s" % model['type'])

    def _build_structure(self, model, shapes):
        members = OrderedDict()
        shape = self._build_initial_shape(model)
        shape['members'] = members

        for name, member_model in model['members'].items():
            member_shape_name = self._get_shape_name(member_model)
            members[name] = {'shape': member_shape_name}
            self._build_model(member_model, shapes, member_shape_name)
        return shape

    def _build_list(self, model, shapes):
        member_shape_name = self._get_shape_name(model)
        shape = self._build_initial_shape(model)
        shape['member'] = {'shape': member_shape_name}
        self._build_model(model['member'], shapes, member_shape_name)
        return shape

    def _build_map(self, model, shapes):
        key_shape_name = self._get_shape_name(model['key'])
        value_shape_name = self._get_shape_name(model['value'])
        shape = self._build_initial_shape(model)
        shape['key'] = {'shape': key_shape_name}
        shape['value'] = {'shape': value_shape_name}
        self._build_model(model['key'], shapes, key_shape_name)
        self._build_model(model['value'], shapes, value_shape_name)
        return shape

    def _build_initial_shape(self, model):
        shape = {
            'type': model['type'],
        }
        if 'documentation' in model:
            shape['documentation'] = model['documentation']
        if 'enum' in model:
            shape['enum'] = model['enum']
        return shape

    def _build_scalar(self, model):
        return self._build_initial_shape(model)

    def _get_shape_name(self, model):
        if 'shape_name' in model:
            return model['shape_name']
        else:
            return self._name_generator.new_shape_name(model['type'])


class ShapeNameGenerator(object):
    """Generate unique shape names for a type.

    This class can be used in conjunction with the DenormalizedStructureBuilder
    to generate unique shape names for a given type.

    """
    def __init__(self):
        self._name_cache = defaultdict(int)

    def new_shape_name(self, type_name):
        """Generate a unique shape name.

        This method will guarantee a unique shape name each time it is
        called with the same type.

        ::

            >>> s = ShapeNameGenerator()
            >>> s.new_shape_name('structure')
            'StructureType1'
            >>> s.new_shape_name('structure')
            'StructureType2'
            >>> s.new_shape_name('list')
            'ListType1'
            >>> s.new_shape_name('list')
            'ListType2'


        :type type_name: string
        :param type_name: The type name (structure, list, map, string, etc.)

        :rtype: string
        :return: A unique shape name for the given type

        """
        self._name_cache[type_name] += 1
        current_index = self._name_cache[type_name]
        return '%sType%s' % (type_name.capitalize(),
                             current_index)

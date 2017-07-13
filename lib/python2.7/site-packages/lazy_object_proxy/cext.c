/* ------------------------------------------------------------------------- */

#include "Python.h"

#include "structmember.h"

#ifndef PyVarObject_HEAD_INIT
#define PyVarObject_HEAD_INIT(type, size) PyObject_HEAD_INIT(type) size,
#endif

#define Proxy__WRAPPED_REPLACE_OR_RETURN_NULL(object) \
    if (PyObject_TypeCheck(object, &Proxy_Type)) { \
        object = Proxy__ensure_wrapped((ProxyObject *)object); \
        if (!object) return NULL; \
    }

#define Proxy__ENSURE_WRAPPED_OR_RETURN_NULL(self) if (!Proxy__ensure_wrapped(self)) return NULL;
#define Proxy__ENSURE_WRAPPED_OR_RETURN_MINUS1(self) if (!Proxy__ensure_wrapped(self)) return -1;

#if PY_MAJOR_VERSION < 3
#define Py_hash_t long
#endif

/* ------------------------------------------------------------------------- */

typedef struct {
    PyObject_HEAD

    PyObject *dict;
    PyObject *wrapped;
    PyObject *factory;
} ProxyObject;

PyTypeObject Proxy_Type;


/* ------------------------------------------------------------------------- */

static PyObject *identity_ref = NULL;
static PyObject *
identity(PyObject *self, PyObject *value)
{
    Py_INCREF(value);
    return value;
}

/* ------------------------------------------------------------------------- */

PyDoc_STRVAR(identity_doc, "Indentity function: returns the single argument.");

static struct PyMethodDef module_functions[] = {
    {"identity", identity, METH_O, identity_doc},
    {NULL,       NULL}
};

/* ------------------------------------------------------------------------- */

static PyObject *Proxy__ensure_wrapped(ProxyObject *self)
{
    PyObject *wrapped;

    if (self->wrapped) {
        return self->wrapped;
    } else {
        if (self->factory) {
            wrapped = PyObject_CallFunctionObjArgs(self->factory, NULL);
            if (wrapped) {
                self->wrapped = wrapped;
                return wrapped;
            } else {
                return NULL;
            }
        } else {
            PyErr_SetString(PyExc_ValueError, "Proxy hasn't been initiated: __factory__ is missing.");
            return NULL;
        }
    }
}

/* ------------------------------------------------------------------------- */

static PyObject *Proxy_new(PyTypeObject *type,
        PyObject *args, PyObject *kwds)
{
    ProxyObject *self;

    self = (ProxyObject *)type->tp_alloc(type, 0);

    if (!self)
        return NULL;

    self->dict = PyDict_New();
    self->wrapped = NULL;
    self->factory = NULL;

    return (PyObject *)self;
}

/* ------------------------------------------------------------------------- */

static int Proxy_raw_init(ProxyObject *self,
        PyObject *factory)
{
    Py_INCREF(factory);
    Py_XDECREF(self->wrapped);
    Py_XDECREF(self->factory);
    self->factory = factory;

    return 0;
}

/* ------------------------------------------------------------------------- */

static int Proxy_init(ProxyObject *self,
        PyObject *args, PyObject *kwds)
{
    PyObject *wrapped = NULL;

    static char *kwlist[] = { "wrapped", NULL };

    if (!PyArg_ParseTupleAndKeywords(args, kwds, "O:ObjectProxy",
            kwlist, &wrapped)) {
        return -1;
    }

    return Proxy_raw_init(self, wrapped);
}

/* ------------------------------------------------------------------------- */

static int Proxy_traverse(ProxyObject *self,
        visitproc visit, void *arg)
{
    Py_VISIT(self->dict);
    Py_VISIT(self->wrapped);
    Py_VISIT(self->factory);
    return 0;
}

/* ------------------------------------------------------------------------- */

static int Proxy_clear(ProxyObject *self)
{
    Py_CLEAR(self->dict);
    Py_CLEAR(self->wrapped);
    Py_CLEAR(self->factory);
    return 0;
}

/* ------------------------------------------------------------------------- */

static void Proxy_dealloc(ProxyObject *self)
{
    PyObject_GC_UnTrack(self);

    Proxy_clear(self);

    Py_TYPE(self)->tp_free(self);
}

/* ------------------------------------------------------------------------- */

static PyObject *Proxy_repr(ProxyObject *self)
{

#if PY_MAJOR_VERSION < 3
    PyObject *factory_repr;

    factory_repr = PyObject_Repr(self->factory);
    if (factory_repr == NULL)
        return NULL;
#endif

    if (self->wrapped) {
#if PY_MAJOR_VERSION >= 3
        return PyUnicode_FromFormat("<%s at %p wrapping %R at %p with factory %R>",
                Py_TYPE(self)->tp_name, self,
                self->wrapped, self->wrapped,
                self->factory);
#else
        PyObject *wrapped_repr;

        wrapped_repr = PyObject_Repr(self->wrapped);
        if (wrapped_repr == NULL)
            return NULL;

        return PyString_FromFormat("<%s at %p wrapping %s at %p with factory %s>",
                Py_TYPE(self)->tp_name, self,
                PyString_AS_STRING(wrapped_repr), self->wrapped,
                PyString_AS_STRING(factory_repr));
#endif
    } else {
#if PY_MAJOR_VERSION >= 3
        return PyUnicode_FromFormat("<%s at %p with factory %R>",
                Py_TYPE(self)->tp_name, self,
                self->factory);
#else
        return PyString_FromFormat("<%s at %p with factory %s>",
                Py_TYPE(self)->tp_name, self,
                PyString_AS_STRING(factory_repr));
#endif
    }
}

/* ------------------------------------------------------------------------- */

static Py_hash_t Proxy_hash(ProxyObject *self)
{
    Proxy__ENSURE_WRAPPED_OR_RETURN_MINUS1(self);

    return PyObject_Hash(self->wrapped);
}

/* ------------------------------------------------------------------------- */

static PyObject *Proxy_str(ProxyObject *self)
{
    Proxy__ENSURE_WRAPPED_OR_RETURN_NULL(self);

    return PyObject_Str(self->wrapped);
}

/* ------------------------------------------------------------------------- */

static PyObject *Proxy_add(PyObject *o1, PyObject *o2)
{
    Proxy__WRAPPED_REPLACE_OR_RETURN_NULL(o1);
    Proxy__WRAPPED_REPLACE_OR_RETURN_NULL(o2);

    return PyNumber_Add(o1, o2);
}

/* ------------------------------------------------------------------------- */

static PyObject *Proxy_subtract(PyObject *o1, PyObject *o2)
{
    Proxy__WRAPPED_REPLACE_OR_RETURN_NULL(o1);
    Proxy__WRAPPED_REPLACE_OR_RETURN_NULL(o2);

    return PyNumber_Subtract(o1, o2);
}

/* ------------------------------------------------------------------------- */

static PyObject *Proxy_multiply(PyObject *o1, PyObject *o2)
{
    Proxy__WRAPPED_REPLACE_OR_RETURN_NULL(o1);
    Proxy__WRAPPED_REPLACE_OR_RETURN_NULL(o2);

    return PyNumber_Multiply(o1, o2);
}

/* ------------------------------------------------------------------------- */

#if PY_MAJOR_VERSION < 3
static PyObject *Proxy_divide(PyObject *o1, PyObject *o2)
{
    Proxy__WRAPPED_REPLACE_OR_RETURN_NULL(o1);
    Proxy__WRAPPED_REPLACE_OR_RETURN_NULL(o2);

    return PyNumber_Divide(o1, o2);
}
#endif

/* ------------------------------------------------------------------------- */

static PyObject *Proxy_remainder(PyObject *o1, PyObject *o2)
{
    Proxy__WRAPPED_REPLACE_OR_RETURN_NULL(o1);
    Proxy__WRAPPED_REPLACE_OR_RETURN_NULL(o2);

    return PyNumber_Remainder(o1, o2);
}

/* ------------------------------------------------------------------------- */

static PyObject *Proxy_divmod(PyObject *o1, PyObject *o2)
{
    Proxy__WRAPPED_REPLACE_OR_RETURN_NULL(o1);
    Proxy__WRAPPED_REPLACE_OR_RETURN_NULL(o2);

    return PyNumber_Divmod(o1, o2);
}

/* ------------------------------------------------------------------------- */

static PyObject *Proxy_power(PyObject *o1, PyObject *o2,
        PyObject *modulo)
{
    Proxy__WRAPPED_REPLACE_OR_RETURN_NULL(o1);
    Proxy__WRAPPED_REPLACE_OR_RETURN_NULL(o2);

    return PyNumber_Power(o1, o2, modulo);
}

/* ------------------------------------------------------------------------- */

static PyObject *Proxy_negative(ProxyObject *self)
{
    Proxy__ENSURE_WRAPPED_OR_RETURN_NULL(self);

    return PyNumber_Negative(self->wrapped);
}

/* ------------------------------------------------------------------------- */

static PyObject *Proxy_positive(ProxyObject *self)
{
    Proxy__ENSURE_WRAPPED_OR_RETURN_NULL(self);

    return PyNumber_Positive(self->wrapped);
}

/* ------------------------------------------------------------------------- */

static PyObject *Proxy_absolute(ProxyObject *self)
{
    Proxy__ENSURE_WRAPPED_OR_RETURN_NULL(self);

    return PyNumber_Absolute(self->wrapped);
}

/* ------------------------------------------------------------------------- */

static int Proxy_bool(ProxyObject *self)
{
    Proxy__ENSURE_WRAPPED_OR_RETURN_MINUS1(self);

    return PyObject_IsTrue(self->wrapped);
}

/* ------------------------------------------------------------------------- */

static PyObject *Proxy_invert(ProxyObject *self)
{
    Proxy__ENSURE_WRAPPED_OR_RETURN_NULL(self);

    return PyNumber_Invert(self->wrapped);
}

/* ------------------------------------------------------------------------- */

static PyObject *Proxy_lshift(PyObject *o1, PyObject *o2)
{
    Proxy__WRAPPED_REPLACE_OR_RETURN_NULL(o1);
    Proxy__WRAPPED_REPLACE_OR_RETURN_NULL(o2);

    return PyNumber_Lshift(o1, o2);
}

/* ------------------------------------------------------------------------- */

static PyObject *Proxy_rshift(PyObject *o1, PyObject *o2)
{
    Proxy__WRAPPED_REPLACE_OR_RETURN_NULL(o1);
    Proxy__WRAPPED_REPLACE_OR_RETURN_NULL(o2);

    return PyNumber_Rshift(o1, o2);
}

/* ------------------------------------------------------------------------- */

static PyObject *Proxy_and(PyObject *o1, PyObject *o2)
{
    Proxy__WRAPPED_REPLACE_OR_RETURN_NULL(o1);
    Proxy__WRAPPED_REPLACE_OR_RETURN_NULL(o2);

    return PyNumber_And(o1, o2);
}

/* ------------------------------------------------------------------------- */

static PyObject *Proxy_xor(PyObject *o1, PyObject *o2)
{
    Proxy__WRAPPED_REPLACE_OR_RETURN_NULL(o1);
    Proxy__WRAPPED_REPLACE_OR_RETURN_NULL(o2);

    return PyNumber_Xor(o1, o2);
}

/* ------------------------------------------------------------------------- */

static PyObject *Proxy_or(PyObject *o1, PyObject *o2)
{
    Proxy__WRAPPED_REPLACE_OR_RETURN_NULL(o1);
    Proxy__WRAPPED_REPLACE_OR_RETURN_NULL(o2);

    return PyNumber_Or(o1, o2);
}

/* ------------------------------------------------------------------------- */

#if PY_MAJOR_VERSION < 3
static PyObject *Proxy_int(ProxyObject *self)
{
    Proxy__ENSURE_WRAPPED_OR_RETURN_NULL(self);

    return PyNumber_Int(self->wrapped);
}
#endif

/* ------------------------------------------------------------------------- */

static PyObject *Proxy_long(ProxyObject *self)
{
    Proxy__ENSURE_WRAPPED_OR_RETURN_NULL(self);

    return PyNumber_Long(self->wrapped);
}

/* ------------------------------------------------------------------------- */

static PyObject *Proxy_float(ProxyObject *self)
{
    Proxy__ENSURE_WRAPPED_OR_RETURN_NULL(self);

    return PyNumber_Float(self->wrapped);
}

/* ------------------------------------------------------------------------- */

#if PY_MAJOR_VERSION < 3
static PyObject *Proxy_oct(ProxyObject *self)
{
    PyNumberMethods *nb;

    Proxy__ENSURE_WRAPPED_OR_RETURN_NULL(self);

    if ((nb = self->wrapped->ob_type->tp_as_number) == NULL ||
        nb->nb_oct == NULL) {
        PyErr_SetString(PyExc_TypeError,
                   "oct() argument can't be converted to oct");
        return NULL;
    }

    return (*nb->nb_oct)(self->wrapped);
}
#endif

/* ------------------------------------------------------------------------- */

#if PY_MAJOR_VERSION < 3
static PyObject *Proxy_hex(ProxyObject *self)
{
    PyNumberMethods *nb;

    Proxy__ENSURE_WRAPPED_OR_RETURN_NULL(self);

    if ((nb = self->wrapped->ob_type->tp_as_number) == NULL ||
        nb->nb_hex == NULL) {
        PyErr_SetString(PyExc_TypeError,
                   "hex() argument can't be converted to hex");
        return NULL;
    }

    return (*nb->nb_hex)(self->wrapped);
}
#endif

/* ------------------------------------------------------------------------- */

static PyObject *Proxy_inplace_add(ProxyObject *self,
        PyObject *other)
{
    PyObject *object = NULL;

    Proxy__ENSURE_WRAPPED_OR_RETURN_NULL(self);
    Proxy__WRAPPED_REPLACE_OR_RETURN_NULL(other);

    object = PyNumber_InPlaceAdd(self->wrapped, other);

    if (!object)
        return NULL;

    Py_DECREF(self->wrapped);
    self->wrapped = object;

    Py_INCREF(self);
    return (PyObject *)self;
}

/* ------------------------------------------------------------------------- */

static PyObject *Proxy_inplace_subtract(
        ProxyObject *self, PyObject *other)
{
    PyObject *object = NULL;

    Proxy__ENSURE_WRAPPED_OR_RETURN_NULL(self);
    Proxy__WRAPPED_REPLACE_OR_RETURN_NULL(other);

    object = PyNumber_InPlaceSubtract(self->wrapped, other);

    if (!object)
        return NULL;

    Py_DECREF(self->wrapped);
    self->wrapped = object;

    Py_INCREF(self);
    return (PyObject *)self;
}

/* ------------------------------------------------------------------------- */

static PyObject *Proxy_inplace_multiply(
        ProxyObject *self, PyObject *other)
{
    PyObject *object = NULL;

    Proxy__ENSURE_WRAPPED_OR_RETURN_NULL(self);
    Proxy__WRAPPED_REPLACE_OR_RETURN_NULL(other);

    object = PyNumber_InPlaceMultiply(self->wrapped, other);

    if (!object)
        return NULL;

    Py_DECREF(self->wrapped);
    self->wrapped = object;

    Py_INCREF(self);
    return (PyObject *)self;
}

/* ------------------------------------------------------------------------- */

#if PY_MAJOR_VERSION < 3
static PyObject *Proxy_inplace_divide(
        ProxyObject *self, PyObject *other)
{
    PyObject *object = NULL;

    Proxy__ENSURE_WRAPPED_OR_RETURN_NULL(self);
    Proxy__WRAPPED_REPLACE_OR_RETURN_NULL(other);

    object = PyNumber_InPlaceDivide(self->wrapped, other);

    if (!object)
        return NULL;

    Py_DECREF(self->wrapped);
    self->wrapped = object;

    Py_INCREF(self);
    return (PyObject *)self;
}
#endif

/* ------------------------------------------------------------------------- */

static PyObject *Proxy_inplace_remainder(
        ProxyObject *self, PyObject *other)
{
    PyObject *object = NULL;

    Proxy__ENSURE_WRAPPED_OR_RETURN_NULL(self);
    Proxy__WRAPPED_REPLACE_OR_RETURN_NULL(other);

    object = PyNumber_InPlaceRemainder(self->wrapped, other);

    if (!object)
        return NULL;

    Py_DECREF(self->wrapped);
    self->wrapped = object;

    Py_INCREF(self);
    return (PyObject *)self;
}

/* ------------------------------------------------------------------------- */

static PyObject *Proxy_inplace_power(ProxyObject *self,
        PyObject *other, PyObject *modulo)
{
    PyObject *object = NULL;

    Proxy__ENSURE_WRAPPED_OR_RETURN_NULL(self);
    Proxy__WRAPPED_REPLACE_OR_RETURN_NULL(other);

    object = PyNumber_InPlacePower(self->wrapped, other, modulo);

    if (!object)
        return NULL;

    Py_DECREF(self->wrapped);
    self->wrapped = object;

    Py_INCREF(self);
    return (PyObject *)self;
}

/* ------------------------------------------------------------------------- */

static PyObject *Proxy_inplace_lshift(ProxyObject *self,
        PyObject *other)
{
    PyObject *object = NULL;

    Proxy__ENSURE_WRAPPED_OR_RETURN_NULL(self);
    Proxy__WRAPPED_REPLACE_OR_RETURN_NULL(other);

    object = PyNumber_InPlaceLshift(self->wrapped, other);

    if (!object)
        return NULL;

    Py_DECREF(self->wrapped);
    self->wrapped = object;

    Py_INCREF(self);
    return (PyObject *)self;
}

/* ------------------------------------------------------------------------- */

static PyObject *Proxy_inplace_rshift(ProxyObject *self,
        PyObject *other)
{
    PyObject *object = NULL;

    Proxy__ENSURE_WRAPPED_OR_RETURN_NULL(self);
    Proxy__WRAPPED_REPLACE_OR_RETURN_NULL(other);

    object = PyNumber_InPlaceRshift(self->wrapped, other);

    if (!object)
        return NULL;

    Py_DECREF(self->wrapped);
    self->wrapped = object;

    Py_INCREF(self);
    return (PyObject *)self;
}

/* ------------------------------------------------------------------------- */

static PyObject *Proxy_inplace_and(ProxyObject *self,
        PyObject *other)
{
    PyObject *object = NULL;

    Proxy__ENSURE_WRAPPED_OR_RETURN_NULL(self);
    Proxy__WRAPPED_REPLACE_OR_RETURN_NULL(other);

    object = PyNumber_InPlaceAnd(self->wrapped, other);

    if (!object)
        return NULL;

    Py_DECREF(self->wrapped);
    self->wrapped = object;

    Py_INCREF(self);
    return (PyObject *)self;
}

/* ------------------------------------------------------------------------- */

static PyObject *Proxy_inplace_xor(ProxyObject *self,
        PyObject *other)
{
    PyObject *object = NULL;

    Proxy__ENSURE_WRAPPED_OR_RETURN_NULL(self);
    Proxy__WRAPPED_REPLACE_OR_RETURN_NULL(other);

    object = PyNumber_InPlaceXor(self->wrapped, other);

    if (!object)
        return NULL;

    Py_DECREF(self->wrapped);
    self->wrapped = object;

    Py_INCREF(self);
    return (PyObject *)self;
}

/* ------------------------------------------------------------------------- */

static PyObject *Proxy_inplace_or(ProxyObject *self,
        PyObject *other)
{
    PyObject *object = NULL;

    Proxy__ENSURE_WRAPPED_OR_RETURN_NULL(self);
    Proxy__WRAPPED_REPLACE_OR_RETURN_NULL(other);

    object = PyNumber_InPlaceOr(self->wrapped, other);

    Py_DECREF(self->wrapped);
    self->wrapped = object;

    Py_INCREF(self);
    return (PyObject *)self;
}

/* ------------------------------------------------------------------------- */

static PyObject *Proxy_floor_divide(PyObject *o1, PyObject *o2)
{
    Proxy__WRAPPED_REPLACE_OR_RETURN_NULL(o1);
    Proxy__WRAPPED_REPLACE_OR_RETURN_NULL(o2);

    return PyNumber_FloorDivide(o1, o2);
}

/* ------------------------------------------------------------------------- */

static PyObject *Proxy_true_divide(PyObject *o1, PyObject *o2)
{
    Proxy__WRAPPED_REPLACE_OR_RETURN_NULL(o1);
    Proxy__WRAPPED_REPLACE_OR_RETURN_NULL(o2);

    return PyNumber_TrueDivide(o1, o2);
}

/* ------------------------------------------------------------------------- */

static PyObject *Proxy_inplace_floor_divide(
        ProxyObject *self, PyObject *other)
{
    PyObject *object = NULL;

    Proxy__ENSURE_WRAPPED_OR_RETURN_NULL(self);
    Proxy__WRAPPED_REPLACE_OR_RETURN_NULL(other);

    object = PyNumber_InPlaceFloorDivide(self->wrapped, other);

    if (!object)
        return NULL;

    Py_DECREF(self->wrapped);
    self->wrapped = object;

    Py_INCREF(self);
    return (PyObject *)self;
}

/* ------------------------------------------------------------------------- */

static PyObject *Proxy_inplace_true_divide(
        ProxyObject *self, PyObject *other)
{
    PyObject *object = NULL;

    Proxy__ENSURE_WRAPPED_OR_RETURN_NULL(self);
    Proxy__WRAPPED_REPLACE_OR_RETURN_NULL(other);

    object = PyNumber_InPlaceTrueDivide(self->wrapped, other);

    if (!object)
        return NULL;

    Py_DECREF(self->wrapped);
    self->wrapped = object;

    Py_INCREF(self);
    return (PyObject *)self;
}

/* ------------------------------------------------------------------------- */

static PyObject *Proxy_index(ProxyObject *self)
{
    Proxy__ENSURE_WRAPPED_OR_RETURN_NULL(self);

    return PyNumber_Index(self->wrapped);
}

/* ------------------------------------------------------------------------- */

static Py_ssize_t Proxy_length(ProxyObject *self)
{
    Proxy__ENSURE_WRAPPED_OR_RETURN_MINUS1(self);

    return PyObject_Length(self->wrapped);
}

/* ------------------------------------------------------------------------- */

static int Proxy_contains(ProxyObject *self,
        PyObject *value)
{
    Proxy__ENSURE_WRAPPED_OR_RETURN_MINUS1(self);

    return PySequence_Contains(self->wrapped, value);
}

/* ------------------------------------------------------------------------- */

static PyObject *Proxy_getitem(ProxyObject *self,
        PyObject *key)
{
    Proxy__ENSURE_WRAPPED_OR_RETURN_NULL(self);

    return PyObject_GetItem(self->wrapped, key);
}

/* ------------------------------------------------------------------------- */

static int Proxy_setitem(ProxyObject *self,
        PyObject *key, PyObject* value)
{
    Proxy__ENSURE_WRAPPED_OR_RETURN_MINUS1(self);

    if (value == NULL)
        return PyObject_DelItem(self->wrapped, key);
    else
        return PyObject_SetItem(self->wrapped, key, value);
}

/* ------------------------------------------------------------------------- */

static PyObject *Proxy_dir(
        ProxyObject *self, PyObject *args)
{
    Proxy__ENSURE_WRAPPED_OR_RETURN_NULL(self);

    return PyObject_Dir(self->wrapped);
}

/* ------------------------------------------------------------------------- */

static PyObject *Proxy_enter(
        ProxyObject *self, PyObject *args, PyObject *kwds)
{
    PyObject *method = NULL;
    PyObject *result = NULL;

    Proxy__ENSURE_WRAPPED_OR_RETURN_NULL(self);

    method = PyObject_GetAttrString(self->wrapped, "__enter__");

    if (!method)
        return NULL;

    result = PyObject_Call(method, args, kwds);

    Py_DECREF(method);

    return result;
}

/* ------------------------------------------------------------------------- */

static PyObject *Proxy_exit(
        ProxyObject *self, PyObject *args, PyObject *kwds)
{
    PyObject *method = NULL;
    PyObject *result = NULL;

    Proxy__ENSURE_WRAPPED_OR_RETURN_NULL(self);

    method = PyObject_GetAttrString(self->wrapped, "__exit__");

    if (!method)
        return NULL;

    result = PyObject_Call(method, args, kwds);

    Py_DECREF(method);

    return result;
}

/* ------------------------------------------------------------------------- */

static PyObject *Proxy_bytes(
        ProxyObject *self, PyObject *args)
{
    Proxy__ENSURE_WRAPPED_OR_RETURN_NULL(self);

    return PyObject_Bytes(self->wrapped);
}

/* ------------------------------------------------------------------------- */

static PyObject *Proxy_reversed(
        ProxyObject *self, PyObject *args)
{
    Proxy__ENSURE_WRAPPED_OR_RETURN_NULL(self);

    return PyObject_CallFunctionObjArgs((PyObject *)&PyReversed_Type,
            self->wrapped, NULL);
}

/* ------------------------------------------------------------------------- */
static PyObject *Proxy_reduce(
        ProxyObject *self, PyObject *args)
{
    Proxy__ENSURE_WRAPPED_OR_RETURN_NULL(self);

    return Py_BuildValue("(O(O))", identity_ref, self->wrapped);
}

/* ------------------------------------------------------------------------- */

#if PY_MAJOR_VERSION >= 3
static PyObject *Proxy_round(
        ProxyObject *self, PyObject *args)
{
    PyObject *module = NULL;
    PyObject *dict = NULL;
    PyObject *round = NULL;

    PyObject *result = NULL;

    Proxy__ENSURE_WRAPPED_OR_RETURN_NULL(self);

    module = PyImport_ImportModule("builtins");

    if (!module)
        return NULL;

    dict = PyModule_GetDict(module);
    round = PyDict_GetItemString(dict, "round");

    if (!round) {
        Py_DECREF(module);
        return NULL;
    }

    Py_INCREF(round);
    Py_DECREF(module);

    result = PyObject_CallFunctionObjArgs(round, self->wrapped, NULL);

    Py_DECREF(round);

    return result;
}
#endif

/* ------------------------------------------------------------------------- */

static PyObject *Proxy_get_name(
        ProxyObject *self)
{
    Proxy__ENSURE_WRAPPED_OR_RETURN_NULL(self);

    return PyObject_GetAttrString(self->wrapped, "__name__");
}

/* ------------------------------------------------------------------------- */

static int Proxy_set_name(ProxyObject *self,
        PyObject *value)
{
    Proxy__ENSURE_WRAPPED_OR_RETURN_MINUS1(self);

    return PyObject_SetAttrString(self->wrapped, "__name__", value);
}

/* ------------------------------------------------------------------------- */

static PyObject *Proxy_get_qualname(
        ProxyObject *self)
{
    Proxy__ENSURE_WRAPPED_OR_RETURN_NULL(self);

    return PyObject_GetAttrString(self->wrapped, "__qualname__");
}

/* ------------------------------------------------------------------------- */

static int Proxy_set_qualname(ProxyObject *self,
        PyObject *value)
{
    Proxy__ENSURE_WRAPPED_OR_RETURN_MINUS1(self);

    return PyObject_SetAttrString(self->wrapped, "__qualname__", value);
}

/* ------------------------------------------------------------------------- */

static PyObject *Proxy_get_module(
        ProxyObject *self)
{
    Proxy__ENSURE_WRAPPED_OR_RETURN_NULL(self);

    return PyObject_GetAttrString(self->wrapped, "__module__");
}

/* ------------------------------------------------------------------------- */

static int Proxy_set_module(ProxyObject *self,
        PyObject *value)
{
    Proxy__ENSURE_WRAPPED_OR_RETURN_MINUS1(self);

    if (PyObject_SetAttrString(self->wrapped, "__module__", value) == -1)
        return -1;

    return PyDict_SetItemString(self->dict, "__module__", value);
}

/* ------------------------------------------------------------------------- */

static PyObject *Proxy_get_doc(
        ProxyObject *self)
{
    Proxy__ENSURE_WRAPPED_OR_RETURN_NULL(self);

    return PyObject_GetAttrString(self->wrapped, "__doc__");
}

/* ------------------------------------------------------------------------- */

static int Proxy_set_doc(ProxyObject *self,
        PyObject *value)
{
    Proxy__ENSURE_WRAPPED_OR_RETURN_MINUS1(self);

    if (PyObject_SetAttrString(self->wrapped, "__doc__", value) == -1)
        return -1;

    return PyDict_SetItemString(self->dict, "__doc__", value);
}

/* ------------------------------------------------------------------------- */

static PyObject *Proxy_get_class(
        ProxyObject *self)
{
    Proxy__ENSURE_WRAPPED_OR_RETURN_NULL(self);

    return PyObject_GetAttrString(self->wrapped, "__class__");
}

/* ------------------------------------------------------------------------- */

static PyObject *Proxy_get_annotations(
        ProxyObject *self)
{
    Proxy__ENSURE_WRAPPED_OR_RETURN_NULL(self);

    return PyObject_GetAttrString(self->wrapped, "__annotations__");
}

/* ------------------------------------------------------------------------- */

static int Proxy_set_annotations(ProxyObject *self,
        PyObject *value)
{
    Proxy__ENSURE_WRAPPED_OR_RETURN_MINUS1(self);

    return PyObject_SetAttrString(self->wrapped, "__annotations__", value);
}

/* ------------------------------------------------------------------------- */

static PyObject *Proxy_get_wrapped(
        ProxyObject *self)
{
    Proxy__ENSURE_WRAPPED_OR_RETURN_NULL(self);

    Py_INCREF(self->wrapped);
    return self->wrapped;
}

/* ------------------------------------------------------------------------- */

static int Proxy_set_wrapped(ProxyObject *self,
        PyObject *value)
{
    if (value) Py_INCREF(value);
    Py_XDECREF(self->wrapped);

    self->wrapped = value;

    return 0;
}

/* ------------------------------------------------------------------------- */

static PyObject *Proxy_get_factory(
        ProxyObject *self)
{
    Py_INCREF(self->factory);
    return self->factory;
}

/* ------------------------------------------------------------------------- */

static int Proxy_set_factory(ProxyObject *self,
        PyObject *value)
{
    if (value) Py_INCREF(value);
    Py_XDECREF(self->factory);

    self->factory = value;

    return 0;
}

/* ------------------------------------------------------------------------- */

static PyObject *Proxy_getattro(
        ProxyObject *self, PyObject *name)
{
    PyObject *object = NULL;
    PyObject *result = NULL;

    static PyObject *getattr_str = NULL;

    object = PyObject_GenericGetAttr((PyObject *)self, name);

    if (object)
        return object;

    PyErr_Clear();

    if (!getattr_str) {
#if PY_MAJOR_VERSION >= 3
        getattr_str = PyUnicode_InternFromString("__getattr__");
#else
        getattr_str = PyString_InternFromString("__getattr__");
#endif
    }

    object = PyObject_GenericGetAttr((PyObject *)self, getattr_str);

    if (!object)
        return NULL;

    result = PyObject_CallFunctionObjArgs(object, name, NULL);

    Py_DECREF(object);

    return result;
}

/* ------------------------------------------------------------------------- */

static PyObject *Proxy_getattr(
        ProxyObject *self, PyObject *args)
{
    PyObject *name = NULL;

#if PY_MAJOR_VERSION >= 3
    if (!PyArg_ParseTuple(args, "U:__getattr__", &name))
        return NULL;
#else
    if (!PyArg_ParseTuple(args, "S:__getattr__", &name))
        return NULL;
#endif

    Proxy__ENSURE_WRAPPED_OR_RETURN_NULL(self);

    return PyObject_GetAttr(self->wrapped, name);
}

/* ------------------------------------------------------------------------- */

static int Proxy_setattro(
        ProxyObject *self, PyObject *name, PyObject *value)
{
    if (PyObject_HasAttr((PyObject *)Py_TYPE(self), name))
        return PyObject_GenericSetAttr((PyObject *)self, name, value);

    Proxy__ENSURE_WRAPPED_OR_RETURN_MINUS1(self);

    return PyObject_SetAttr(self->wrapped, name, value);
}

/* ------------------------------------------------------------------------- */

static PyObject *Proxy_richcompare(ProxyObject *self,
        PyObject *other, int opcode)
{
    Proxy__ENSURE_WRAPPED_OR_RETURN_NULL(self);

    return PyObject_RichCompare(self->wrapped, other, opcode);
}

/* ------------------------------------------------------------------------- */

static PyObject *Proxy_iter(ProxyObject *self)
{
    Proxy__ENSURE_WRAPPED_OR_RETURN_NULL(self);

    return PyObject_GetIter(self->wrapped);
}

/* ------------------------------------------------------------------------- */

static PyObject *Proxy_call(
        ProxyObject *self, PyObject *args, PyObject *kwds)
{
    Proxy__ENSURE_WRAPPED_OR_RETURN_NULL(self);

    return PyObject_Call(self->wrapped, args, kwds);
}

/* ------------------------------------------------------------------------- */;

static PyNumberMethods Proxy_as_number = {
    (binaryfunc)Proxy_add,                  /*nb_add*/
    (binaryfunc)Proxy_subtract,             /*nb_subtract*/
    (binaryfunc)Proxy_multiply,             /*nb_multiply*/
#if PY_MAJOR_VERSION < 3
    (binaryfunc)Proxy_divide,               /*nb_divide*/
#endif
    (binaryfunc)Proxy_remainder,            /*nb_remainder*/
    (binaryfunc)Proxy_divmod,               /*nb_divmod*/
    (ternaryfunc)Proxy_power,               /*nb_power*/
    (unaryfunc)Proxy_negative,              /*nb_negative*/
    (unaryfunc)Proxy_positive,              /*nb_positive*/
    (unaryfunc)Proxy_absolute,              /*nb_absolute*/
    (inquiry)Proxy_bool,                    /*nb_nonzero/nb_bool*/
    (unaryfunc)Proxy_invert,                /*nb_invert*/
    (binaryfunc)Proxy_lshift,               /*nb_lshift*/
    (binaryfunc)Proxy_rshift,               /*nb_rshift*/
    (binaryfunc)Proxy_and,                  /*nb_and*/
    (binaryfunc)Proxy_xor,                  /*nb_xor*/
    (binaryfunc)Proxy_or,                   /*nb_or*/
#if PY_MAJOR_VERSION < 3
    0,                                      /*nb_coerce*/
#endif
#if PY_MAJOR_VERSION < 3
    (unaryfunc)Proxy_int,                   /*nb_int*/
    (unaryfunc)Proxy_long,                  /*nb_long*/
#else
    (unaryfunc)Proxy_long,                  /*nb_int*/
    0,                                      /*nb_long/nb_reserved*/
#endif
    (unaryfunc)Proxy_float,                 /*nb_float*/
#if PY_MAJOR_VERSION < 3
    (unaryfunc)Proxy_oct,                   /*nb_oct*/
    (unaryfunc)Proxy_hex,                   /*nb_hex*/
#endif
    (binaryfunc)Proxy_inplace_add,          /*nb_inplace_add*/
    (binaryfunc)Proxy_inplace_subtract,     /*nb_inplace_subtract*/
    (binaryfunc)Proxy_inplace_multiply,     /*nb_inplace_multiply*/
#if PY_MAJOR_VERSION < 3
    (binaryfunc)Proxy_inplace_divide,       /*nb_inplace_divide*/
#endif
    (binaryfunc)Proxy_inplace_remainder,    /*nb_inplace_remainder*/
    (ternaryfunc)Proxy_inplace_power,       /*nb_inplace_power*/
    (binaryfunc)Proxy_inplace_lshift,       /*nb_inplace_lshift*/
    (binaryfunc)Proxy_inplace_rshift,       /*nb_inplace_rshift*/
    (binaryfunc)Proxy_inplace_and,          /*nb_inplace_and*/
    (binaryfunc)Proxy_inplace_xor,          /*nb_inplace_xor*/
    (binaryfunc)Proxy_inplace_or,           /*nb_inplace_or*/
    (binaryfunc)Proxy_floor_divide,         /*nb_floor_divide*/
    (binaryfunc)Proxy_true_divide,          /*nb_true_divide*/
    (binaryfunc)Proxy_inplace_floor_divide, /*nb_inplace_floor_divide*/
    (binaryfunc)Proxy_inplace_true_divide,  /*nb_inplace_true_divide*/
    (unaryfunc)Proxy_index,                 /*nb_index*/
};

static PySequenceMethods Proxy_as_sequence = {
    (lenfunc)Proxy_length,      /*sq_length*/
    0,                          /*sq_concat*/
    0,                          /*sq_repeat*/
    0,                          /*sq_item*/
    0,                          /*sq_slice*/
    0,                          /*sq_ass_item*/
    0,                          /*sq_ass_slice*/
    (objobjproc)Proxy_contains, /* sq_contains */
};

static PyMappingMethods Proxy_as_mapping = {
    (lenfunc)Proxy_length,        /*mp_length*/
    (binaryfunc)Proxy_getitem,    /*mp_subscript*/
    (objobjargproc)Proxy_setitem, /*mp_ass_subscript*/
};

static PyMethodDef Proxy_methods[] = {
    { "__dir__",    (PyCFunction)Proxy_dir, METH_NOARGS, 0 },
    { "__enter__",  (PyCFunction)Proxy_enter,
                    METH_VARARGS | METH_KEYWORDS, 0 },
    { "__exit__",   (PyCFunction)Proxy_exit,
                    METH_VARARGS | METH_KEYWORDS, 0 },
    { "__getattr__", (PyCFunction)Proxy_getattr,
                    METH_VARARGS , 0 },
    { "__bytes__",  (PyCFunction)Proxy_bytes, METH_NOARGS, 0 },
    { "__reversed__", (PyCFunction)Proxy_reversed, METH_NOARGS, 0 },
    { "__reduce__", (PyCFunction)Proxy_reduce, METH_NOARGS, 0 },
    { "__reduce_ex__", (PyCFunction)Proxy_reduce, METH_O, 0 },
#if PY_MAJOR_VERSION >= 3
    { "__round__",  (PyCFunction)Proxy_round, METH_NOARGS, 0 },
#endif
    { NULL, NULL },
};

static PyGetSetDef Proxy_getset[] = {
    { "__name__",           (getter)Proxy_get_name,
                            (setter)Proxy_set_name, 0 },
    { "__qualname__",       (getter)Proxy_get_qualname,
                            (setter)Proxy_set_qualname, 0 },
    { "__module__",         (getter)Proxy_get_module,
                            (setter)Proxy_set_module, 0 },
    { "__doc__",            (getter)Proxy_get_doc,
                            (setter)Proxy_set_doc, 0 },
    { "__class__",          (getter)Proxy_get_class,
                            NULL, 0 },
    { "__annotations__",    (getter)Proxy_get_annotations,
                            (setter)Proxy_set_annotations, 0 },
    { "__wrapped__",        (getter)Proxy_get_wrapped,
                            (setter)Proxy_set_wrapped, 0 },
    { "__factory__",        (getter)Proxy_get_factory,
                            (setter)Proxy_set_factory, 0 },
    { NULL },
};

PyTypeObject Proxy_Type = {
    PyVarObject_HEAD_INIT(NULL, 0)
    "Proxy",                  /*tp_name*/
    sizeof(ProxyObject),            /*tp_basicsize*/
    0,                              /*tp_itemsize*/
    /* methods */
    (destructor)Proxy_dealloc,      /*tp_dealloc*/
    0,                              /*tp_print*/
    0,                              /*tp_getattr*/
    0,                              /*tp_setattr*/
    0,                              /*tp_compare*/
    (unaryfunc)Proxy_repr,          /*tp_repr*/
    &Proxy_as_number,               /*tp_as_number*/
    &Proxy_as_sequence,             /*tp_as_sequence*/
    &Proxy_as_mapping,              /*tp_as_mapping*/
    (hashfunc)Proxy_hash,           /*tp_hash*/
    (ternaryfunc)Proxy_call,        /*tp_call*/
    (unaryfunc)Proxy_str,           /*tp_str*/
    (getattrofunc)Proxy_getattro,   /*tp_getattro*/
    (setattrofunc)Proxy_setattro,   /*tp_setattro*/
    0,                              /*tp_as_buffer*/
#if PY_MAJOR_VERSION < 3
    Py_TPFLAGS_DEFAULT | Py_TPFLAGS_BASETYPE | Py_TPFLAGS_HAVE_GC | Py_TPFLAGS_CHECKTYPES,
                                    /*tp_flags*/
#else
    Py_TPFLAGS_DEFAULT | Py_TPFLAGS_BASETYPE | Py_TPFLAGS_HAVE_GC,
                                    /*tp_flags*/
#endif
    0,                              /*tp_doc*/
    (traverseproc)Proxy_traverse,   /*tp_traverse*/
    (inquiry)Proxy_clear,           /*tp_clear*/
    (richcmpfunc)Proxy_richcompare, /*tp_richcompare*/
    0,                              /*tp_weaklistoffset*/
    (getiterfunc)Proxy_iter,        /*tp_iter*/
    0,                              /*tp_iternext*/
    Proxy_methods,                  /*tp_methods*/
    0,                              /*tp_members*/
    Proxy_getset,                   /*tp_getset*/
    0,                              /*tp_base*/
    0,                              /*tp_dict*/
    0,                              /*tp_descr_get*/
    0,                              /*tp_descr_set*/
    offsetof(ProxyObject, dict),    /*tp_dictoffset*/
    (initproc)Proxy_init,           /*tp_init*/
    PyType_GenericAlloc,            /*tp_alloc*/
    Proxy_new,                      /*tp_new*/
    PyObject_GC_Del,                /*tp_free*/
    0,                              /*tp_is_gc*/
};

/* ------------------------------------------------------------------------- */

#if PY_MAJOR_VERSION >= 3
static struct PyModuleDef moduledef = {
    PyModuleDef_HEAD_INIT,
    "lazy_object_proxy.cext", /* m_name */
    NULL,                     /* m_doc */
    -1,                       /* m_size */
    module_functions,         /* m_methods */
    NULL,                     /* m_reload */
    NULL,                     /* m_traverse */
    NULL,                     /* m_clear */
    NULL,                     /* m_free */
};
#endif

static PyObject *
moduleinit(void)
{
    PyObject *module;
    PyObject *dict;

#if PY_MAJOR_VERSION >= 3
    module = PyModule_Create(&moduledef);
#else
    module = Py_InitModule3("lazy_object_proxy.cext", module_functions, NULL);
#endif

    if (module == NULL)
        return NULL;

    if (PyType_Ready(&Proxy_Type) < 0)
        return NULL;

    dict = PyModule_GetDict(module);
    if (dict == NULL)
        return NULL;
    identity_ref = PyDict_GetItemString(dict, "identity");
    if (identity_ref == NULL)
        return NULL;
    Py_INCREF(identity_ref);

    Py_INCREF(&Proxy_Type);
    PyModule_AddObject(module, "Proxy",
            (PyObject *)&Proxy_Type);
    return module;
}

#if PY_MAJOR_VERSION < 3
PyMODINIT_FUNC initcext(void)
{
    moduleinit();
}
#else
PyMODINIT_FUNC PyInit_cext(void)
{
    return moduleinit();
}
#endif

/* ------------------------------------------------------------------------- */

#include <Python.h>


static PyMethodDef TestextMethods[] = {
    {NULL, NULL, 0, NULL}
};


#if PY_MAJOR_VERSION >=3
static struct PyModuleDef testextmodule = {
    PyModuleDef_HEAD_INIT,  /* This should correspond to a PyModuleDef_Base type */
    "testext",  /* This is the module name */
    "Test extension module",  /* This is the module docstring */
    -1,  /* This defines the size of the module and says everything is global */
    TestextMethods  /* This is the method definition */
};

PyObject*
PyInit_testext(void)
{
    return PyModule_Create(&testextmodule);
}
#else
PyMODINIT_FUNC
inittestext(void)
{
    Py_InitModule("testext", TestextMethods);
}
#endif

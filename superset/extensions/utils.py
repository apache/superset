import importlib.abc
import importlib.util
import pathlib
import sys
from typing import Any, Tuple


class InMemoryLoader(importlib.abc.Loader):
    def __init__(
        self, module_name: str, source: str, is_package: bool, origin: str
    ) -> None:
        self.module_name = module_name
        self.source = source
        self.is_package = is_package
        self.origin = origin

    def exec_module(self, module: Any) -> None:
        module.__file__ = self.origin
        module.__package__ = (
            self.module_name if self.is_package else self.module_name.rpartition(".")[0]
        )
        if self.is_package:
            module.__path__ = []
        exec(self.source, module.__dict__)  # noqa: S102


class InMemoryFinder(importlib.abc.MetaPathFinder):
    def __init__(self, file_dict: dict[str, str]) -> None:
        self.modules: dict[str, Tuple[Any, Any, Any]] = {}
        for path, code in file_dict.items():
            mod_name, is_package = self._get_module_name(path)
            self.modules[mod_name] = (code, is_package, path)

    def _get_module_name(self, file_path: str) -> Tuple[str, bool]:
        parts = list(pathlib.Path(file_path).parts)
        is_package = parts[-1] == "__init__.py"
        if is_package:
            parts = parts[:-1]
        else:
            parts[-1] = pathlib.Path(parts[-1]).stem

        mod_name = ".".join(parts)
        return mod_name, is_package

    def find_spec(self, fullname: str, path: Any, target: Any = None) -> Any | None:
        if fullname in self.modules:
            source, is_package, origin = self.modules[fullname]
            return importlib.util.spec_from_loader(
                fullname,
                InMemoryLoader(fullname, source, is_package, origin),
                origin=origin,
                is_package=is_package,
            )
        return None


def install_in_memory_importer(file_dict: dict[str, str]) -> None:
    finder = InMemoryFinder(file_dict)
    sys.meta_path.insert(0, finder)


def eager_import(module_name: str) -> Any:
    if module_name in sys.modules:
        return sys.modules[module_name]
    return importlib.import_module(module_name)

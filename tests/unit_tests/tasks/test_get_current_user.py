"""Testes unitários para get_current_user (superset/tasks/utils.py).

Técnicas aplicadas:
  - Caixa-preta : particionamento de equivalência (CV1, CI1-CI3)
  - Caixa-branca: cobertura de branch + MC/DC (D1, D2)
  - Isolamento  : substituição de g via Flask app_context + patch direto
"""
import importlib.util
import pathlib
import sys
import types
from unittest.mock import MagicMock, patch

import pytest
from flask import Flask


def _stub(name, **attrs):
    mod = types.ModuleType(name)
    mod.__dict__.update(attrs)
    sys.modules.setdefault(name, mod)
    return mod


_stub("celery")
_stub("celery.utils")
_stub("celery.utils.log", get_task_logger=lambda n: MagicMock())
_stub("superset_core")
_stub("superset_core.tasks")
_stub("superset_core.tasks.types", TaskProperties=dict, TaskScope=MagicMock())
_stub("superset.tasks.exceptions",
      ExecutorNotFoundError=Exception, InvalidExecutorError=Exception)
_stub("superset.tasks.types",
      ChosenExecutor=MagicMock(), Executor=MagicMock(),
      ExecutorType=MagicMock(), FixedExecutor=MagicMock())
_stub("superset.utils")
_stub("superset.utils.json",
      loads=MagicMock(), dumps=MagicMock(), JSONDecodeError=ValueError)
_stub("superset.utils.hashing",
      hash_from_str=MagicMock(return_value="abc" * 30))
_stub("superset.utils.urls", get_url_path=MagicMock())

_path = pathlib.Path(__file__).parents[3] / "superset" / "tasks" / "utils.py"
_spec = importlib.util.spec_from_file_location("superset.tasks.utils", _path)
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)

get_current_user = _mod.get_current_user


@pytest.fixture()
def app():
    app = Flask(__name__)
    app.config["TESTING"] = True
    return app


class TestGetCurrentUser:
    def test_retorna_none_quando_g_nao_possui_user(self, app):
        """CT01 | CI1 | D1=F (hasattr=False, curto-circuito)."""
        mock_g = MagicMock(spec=[])          # spec=[] → hasattr(g, "user") == False
        with app.app_context():
            with patch.object(_mod, "g", mock_g):
                assert get_current_user() is None

    def test_retorna_none_quando_g_user_e_none(self, app):
        """CT02 | CI2 | D1=F (hasattr=True, g.user falsy)."""
        mock_g = MagicMock()
        mock_g.user = None
        with app.app_context():
            with patch.object(_mod, "g", mock_g):
                assert get_current_user() is None

    def test_retorna_none_quando_usuario_anonimo(self, app):
        """CT03 | CI3 | D1=V; D2=F (is_anonymous=True)."""
        usuario = MagicMock()
        usuario.is_anonymous = True
        mock_g = MagicMock()
        mock_g.user = usuario
        with app.app_context():
            with patch.object(_mod, "g", mock_g):
                assert get_current_user() is None

    def test_retorna_username_quando_usuario_autenticado(self, app):
        """CT04 | CV1 | D1=V; D2=V."""
        usuario = MagicMock()
        usuario.is_anonymous = False
        usuario.username = "andre"
        mock_g = MagicMock()
        mock_g.user = usuario
        with app.app_context():
            with patch.object(_mod, "g", mock_g):
                assert get_current_user() == "andre"

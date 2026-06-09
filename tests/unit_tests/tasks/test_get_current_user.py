# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
"""Testes unitÃ¡rios para get_current_user (superset/tasks/utils.py).

TÃ©cnicas aplicadas:
  - Caixa-preta : particionamento de equivalÃªncia (CV1, CI1-CI3)
  - Caixa-branca: cobertura de branch + MC/DC (D1, D2)
  - Isolamento  : substituiÃ§Ã£o de g via Flask app_context + patch direto
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
_stub(
    "superset.tasks.exceptions",
    ExecutorNotFoundError=Exception,
    InvalidExecutorError=Exception,
)
_stub(
    "superset.tasks.types",
    ChosenExecutor=MagicMock(),
    Executor=MagicMock(),
    ExecutorType=MagicMock(),
    FixedExecutor=MagicMock(),
)
_stub("superset.utils")
_stub(
    "superset.utils.json",
    loads=MagicMock(),
    dumps=MagicMock(),
    JSONDecodeError=ValueError,
)
_stub("superset.utils.hashing", hash_from_str=MagicMock(return_value="abc" * 30))
_stub("superset.utils.urls", get_url_path=MagicMock())

_path = pathlib.Path(__file__).parents[3] / "superset" / "tasks" / "utils.py"
_spec = importlib.util.spec_from_file_location("superset.tasks.utils", _path)
assert _spec is not None
assert _spec.loader is not None
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)

get_current_user = _mod.get_current_user


@pytest.fixture
def app():
    application = Flask(__name__)
    application.config["TESTING"] = True
    return application


class TestGetCurrentUser:
    def test_retorna_none_quando_g_nao_possui_user(self, app):
        """CT01 | CI1 | D1=F (hasattr=False, curto-circuito)."""
        mock_g = MagicMock(spec=[])  # spec=[] â†’ hasattr(g, "user") == False
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

    def test_retorna_none_quando_g_user_e_falsy_nao_none(self, app):
        """CT05 | CI2 ampliada | D1=F (g.user = 0, falsy mas nÃ£o None).

        Verifica que qualquer valor falsy em g.user (nÃ£o apenas None) encerra
        o fluxo antes de avaliar is_anonymous, retornando None.
        """
        mock_g = MagicMock()
        mock_g.user = 0
        with app.app_context():
            with patch.object(_mod, "g", mock_g):
                assert get_current_user() is None

    def test_retorna_string_vazia_quando_username_e_vazio(self, app):
        """CT06 | CV1 borda | D1=V; D2=V; username = "".

        Comportamento nÃ£o especificado formalmente â€” a funÃ§Ã£o retorna string
        vazia em vez de None quando user.username == "".
        """
        usuario = MagicMock()
        usuario.is_anonymous = False
        usuario.username = ""
        mock_g = MagicMock()
        mock_g.user = usuario
        with app.app_context():
            with patch.object(_mod, "g", mock_g):
                assert get_current_user() == ""

    def test_retorna_none_quando_username_e_none(self, app):
        """CT07 | CV1 borda | D1=V; D2=V; username = None.

        username=None retorna None via user.username, nÃ£o pelo fluxo principal
        (ou seja, a guarda `not user.is_anonymous` Ã© satisfeita, mas o valor
        retornado Ã© None porque user.username Ã© None).
        """
        usuario = MagicMock()
        usuario.is_anonymous = False
        usuario.username = None
        mock_g = MagicMock()
        mock_g.user = usuario
        with app.app_context():
            with patch.object(_mod, "g", mock_g):
                assert get_current_user() is None

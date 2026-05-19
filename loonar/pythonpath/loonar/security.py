# Licensed to the Apache Software Foundation (ASF) under one or more
# contributor license agreements.  See the NOTICE file distributed with this
# work for additional information regarding copyright ownership.  The ASF
# licenses this file to You under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
from __future__ import annotations

import logging
import os
import socket
from threading import Lock
from typing import List, Optional
from urllib.parse import urlparse

from flask import current_app, flash, redirect, request, Response
from flask_appbuilder import AppBuilder, expose
from flask_appbuilder.security.forms import LoginForm_db
from flask_appbuilder.security.manager import AUTH_LDAP
from flask_appbuilder.security.sqla.models import User
from flask_appbuilder.security.views import AuthDBView
from flask_babel import get_locale, gettext as _
from flask_login import login_user
from ldap3 import ALL, Connection, Server, SUBTREE
from ldap3.core.exceptions import LDAPException
from ldap3.utils.conv import escape_filter_chars
from sqlalchemy.orm import Session
from wtforms import HiddenField, SelectField

from superset.security import SupersetSecurityManager

from .ldap_config import get_ldap_setting, get_ldap_user_base_aliases

logger = logging.getLogger(__name__)


class LoonarLoginForm(LoginForm_db):
    auth_provider = HiddenField(default="database")
    ldap_user_base_alias = SelectField(_("Contexto LDAP"), choices=[])


class LoonarAuthDBView(AuthDBView):
    form = LoonarLoginForm
    template = "security/login.html"

    @expose("/login/", methods=["GET", "POST"])
    def login(self) -> Response:
        form = self.form()
        self._populate_ldap_alias_choices(form)

        if request.method == "POST" and form.validate_on_submit():
            provider = (form.auth_provider.data or "database").lower()
            if provider == "ldap":
                result = self._login_with_ldap(form)
            else:
                result = self._login_with_database(form)
            if result:
                return result

        # Prioriza querystring, depois env var, depois default
        login_form_type = request.args.get("login_form_type")
        if login_form_type:
            login_form_type = login_form_type.strip().lower()
        else:
            login_form_type = os.getenv("SUPERSET_LOGIN_FORM_TYPE", "ldap").strip().lower()

        locale = str(get_locale() or "")
        is_pt = locale.lower().startswith("pt")
        ldap_profile_label = (
            "Perfil do usuário" if is_pt else "User Profile"
        )

        return self.render_template(
            self.template,
            title=self.title,
            form=form,
            ldap_login_enabled=current_app.config.get("AUTH_TYPE") == AUTH_LDAP,
            login_form_type=login_form_type,
            ldap_profile_label=ldap_profile_label,
            is_pt=is_pt,
            appbuilder=self.appbuilder,
        )

    def _populate_ldap_alias_choices(self, form: LoonarLoginForm) -> None:
        sm = self.appbuilder.sm
        choices: list[tuple[str, str]] = []
        if hasattr(sm, "get_ldap_user_base_choices"):
            choices = sm.get_ldap_user_base_choices()

        form.ldap_user_base_alias.choices = choices
        if choices and not form.ldap_user_base_alias.data:
            form.ldap_user_base_alias.data = choices[0][0]

    def _login_with_database(self, form: LoonarLoginForm) -> Optional[Response]:
        try:
            user = self.appbuilder.sm.auth_user_db(
                form.username.data, form.password.data
            )
            if not user:
                flash(_("Usuário ou senha inválidos."), "danger")
                return None
            remember = getattr(form, "remember_me", None)
            login_user(user, remember=bool(remember.data) if remember else False)
            return redirect(self.get_redirect())
        except Exception as ex:
            logger.error(
                "Erro durante autenticação do banco de dados para "
                f"usuário {form.username.data}: {str(ex)}",
                exc_info=True,
            )
            flash(_("Erro ao processar login. Tente novamente."), "danger")
            return None

    def _login_with_ldap(self, form: LoonarLoginForm) -> Optional[Response]:
        try:
            selected_alias = (form.ldap_user_base_alias.data or "").strip()
            sm = self.appbuilder.sm

            if hasattr(sm, "is_ldap_server_reachable") and not sm.is_ldap_server_reachable():
                flash(_("Servidor de autenticação indisponível"), "danger")
                return None

            if hasattr(sm, "auth_user_ldap_with_alias"):
                user = sm.auth_user_ldap_with_alias(
                    form.username.data,
                    form.password.data,
                    selected_alias,
                )
            else:
                user = sm.auth_user_ldap(form.username.data, form.password.data)
            if not user:
                flash(_("Credenciais inválidas no Active Directory."), "danger")
                return None
            login_user(user, remember=False)
            return redirect(self.get_redirect())
        except LDAPException as ex:
            logger.error(
                f"Erro de conexão LDAP para usuário {form.username.data}: {str(ex)}",
                exc_info=True,
            )
            flash(_("Servidor de autenticação indisponível"), "danger")
            return None
        except Exception as ex:
            logger.error(
                "Erro durante autenticação LDAP para "
                f"usuário {form.username.data}: {str(ex)}",
                exc_info=True,
            )
            flash(_("Erro ao processar login. Tente novamente."), "danger")
            return None


class LoonarSecurityManager(SupersetSecurityManager):
    authdbview = LoonarAuthDBView

    def __init__(self, appbuilder: AppBuilder) -> None:
        super().__init__(appbuilder)
        self._ldap_auth_lock = Lock()

        ldap_mode = (get_ldap_setting("LOONAR_LDAP_MODE") or "real").strip().lower()
        self.ldap_group_base = (
            get_ldap_setting("LOONAR_LDAP_GROUP_BASE_MOCK", "")
            if ldap_mode == "mock"
            else get_ldap_setting("LOONAR_LDAP_GROUP_BASE_REAL", "")
        ) or ""

        default_user_base = self.ldap_group_base or ""
        self.ldap_user_base_aliases = get_ldap_user_base_aliases(default_user_base)
        if not self.ldap_user_base_aliases and default_user_base:
            self.ldap_user_base_aliases = {"Padrão": default_user_base}

        self.ldap_user_base = next(iter(self.ldap_user_base_aliases.values()), "")
        self.ldap_uid_attr = (
            get_ldap_setting("LOONAR_LDAP_UID_ATTR", "sAMAccountName")
            or "sAMAccountName"
        )

    def get_ldap_user_base_choices(self) -> list[tuple[str, str]]:
        return [(alias, alias) for alias in self.ldap_user_base_aliases.keys()]

    def is_ldap_server_reachable(self) -> bool:
        server_uri = (self.auth_ldap_server or "").strip()
        if not server_uri:
            return False

        parsed = urlparse(server_uri)
        host = parsed.hostname or ""
        if not host:
            return False

        default_port = 636 if parsed.scheme == "ldaps" else 389
        port = parsed.port or default_port

        timeout_setting = get_ldap_setting("LOONAR_LDAP_CONNECT_TIMEOUT", "3")
        try:
            timeout = float(timeout_setting)
        except (TypeError, ValueError):
            timeout = 3.0

        try:
            with socket.create_connection((host, port), timeout=timeout):
                return True
        except OSError:
            return False

    def _resolve_ldap_user_base_from_alias(self, selected_alias: Optional[str]) -> str:
        alias = (selected_alias or "").strip()
        if alias:
            selected_dn = self.ldap_user_base_aliases.get(alias)
            if selected_dn:
                return selected_dn
        return self.ldap_user_base

    def auth_user_ldap_with_alias(
        self,
        username: str,
        password: str,
        selected_alias: Optional[str] = None,
    ) -> Optional[User]:
        selected_ldap_user_base = self._resolve_ldap_user_base_from_alias(selected_alias)
        return self._auth_user_ldap_internal(
            username,
            password,
            selected_ldap_user_base,
        )

    def auth_user_ldap(self, username: str, password: str) -> Optional[User]:
        return self._auth_user_ldap_internal(username, password, self.ldap_user_base)

    def _auth_user_ldap_internal(
        self,
        username: str,
        password: str,
        selected_ldap_user_base: str,
    ) -> Optional[User]:
        config = current_app.config
        had_auth_ldap_search = "AUTH_LDAP_SEARCH" in config
        original_auth_ldap_search = config.get("AUTH_LDAP_SEARCH")
        try:
            with self._ldap_auth_lock:
                config["AUTH_LDAP_SEARCH"] = selected_ldap_user_base

                # Verifica se o usuário já existe no banco ANTES da autenticação
                existing_user = self.find_user(username=username)
                is_new_user = existing_user is None

                user = super().auth_user_ldap(username, password)

            if user and is_new_user:
                # Sincroniza roles apenas para usuários novos (primeira vez fazendo login)
                logger.info(
                    f"Novo usuário LDAP detectado: {username}. "
                    "Sincronizando roles dos grupos LDAP."
                )
                self._sync_roles_from_ldap_groups(
                    user,
                    username,
                    selected_ldap_user_base,
                )
            elif user and not is_new_user:
                logger.debug(
                    f"Usuário LDAP existente: {username}. "
                    "Mantendo roles atuais (sincronização desabilitada)."
                )

            return user
        except Exception as ex:
            logger.error(
                f"Erro ao sincronizar roles LDAP para usuário {username}: {str(ex)}",
                exc_info=True,
            )
            # Retorna o usuário mesmo que a sincronização de roles falhe
            with self._ldap_auth_lock:
                config["AUTH_LDAP_SEARCH"] = selected_ldap_user_base
                return super().auth_user_ldap(username, password)
        finally:
            with self._ldap_auth_lock:
                if had_auth_ldap_search:
                    config["AUTH_LDAP_SEARCH"] = original_auth_ldap_search
                else:
                    config.pop("AUTH_LDAP_SEARCH", None)

    def _sync_roles_from_ldap_groups(
        self,
        user: User,
        username: str,
        selected_ldap_user_base: Optional[str] = None,
    ) -> None:
        if not self.ldap_group_base:
            return

        connection = self._get_bound_connection()
        if connection is None:
            logger.warning(
                "Não foi possível obter conexão LDAP para sincronizar "
                f"roles do usuário {username}"
            )
            return

        try:
            user_dn = self._lookup_user_dn(
                connection,
                username,
                selected_ldap_user_base,
            )
            if not user_dn:
                logger.debug(f"DN do usuário {username} não encontrado no LDAP")
                return

            group_names = self._fetch_group_names(connection, user_dn)
            if not group_names:
                logger.debug(f"Nenhum grupo LDAP encontrado para o usuário {username}")
                return

            session: Session = self.session
            matching_roles = (
                session.query(self.role_model)
                .filter(self.role_model.name.in_(group_names))
                .all()
            )
            if not matching_roles:
                logger.debug(
                    "Nenhuma role correspondente encontrada para "
                    f"grupos LDAP do usuário {username}"
                )
                return

            current_names = {role.name for role in user.roles}
            new_names = {role.name for role in matching_roles}
            if new_names == current_names:
                logger.debug(f"Roles do usuário {username} já estão sincronizadas")
                return

            user.roles = matching_roles
            session.commit()
            logger.info(f"Roles do usuário {username} sincronizadas: {new_names}")
        except Exception as ex:
            logger.error(
                f"Erro ao sincronizar roles LDAP para usuário {username}: {str(ex)}",
                exc_info=True,
            )
            # Não lança exceção, apenas loga o erro
        finally:
            try:
                connection.unbind()
            except Exception as ex:
                logger.warning(f"Erro ao desconectar do LDAP: {str(ex)}")

    def register_views(self) -> None:
        """
        Corrige o registro das views para garantir que self.auth_view nunca seja None.
        Registra a view de autenticação customizada primeiro para que
        a rota /login/ tenha precedência sobre as views padrão do Superset/FAB.
        """
        if not current_app.config.get("FAB_ADD_SECURITY_VIEWS", True):
            return

        custom_auth_view = None
        if self.authdbview is not None:
            custom_auth_view = self.authdbview()
            # Endpoint único; a precedência da rota vem da ordem de registro.
            custom_auth_view.endpoint = "LoonarAuthDBView"
            self.appbuilder.add_view_no_menu(custom_auth_view)
            self.auth_view = custom_auth_view

        # Registra as demais views padrão do Superset/FAB.
        super().register_views()

        # Mantém referência explícita para o auth_view customizado.
        if custom_auth_view is not None:
            self.auth_view = custom_auth_view

            # Remove SupersetAuthView se existir
            for view in list(self.appbuilder.baseviews):
                if (
                    view.__class__.__name__ == "SupersetAuthView"
                    and view != custom_auth_view
                ):
                    self.appbuilder.baseviews.remove(view)

        # Remove duplicatas de MENU (não APIs)
        for view in list(self.appbuilder.baseviews):
            if hasattr(view, "route_base") and view.route_base in [
                "/roles",
                "/users",
                "/groups",
                "/registrations",
            ]:
                self.appbuilder.baseviews.remove(view)

        # Limpa itens do menu de segurança
        security_menu = next(
            (m for m in self.appbuilder.menu.get_list() if m.name == "Security"), None
        )
        if security_menu:
            for item in list(security_menu.childs):
                if item.name in [
                    "List Roles",
                    "List Users",
                    "List Groups",
                    "User Registrations",
                ]:
                    security_menu.childs.remove(item)

    def _get_bound_connection(self) -> Optional[Connection]:
        ldap_mode = (get_ldap_setting("LOONAR_LDAP_MODE") or "real").strip().lower()
        server_uri = (
            get_ldap_setting("LOONAR_LDAP_SERVER_MOCK")
            if ldap_mode == "mock"
            else get_ldap_setting("LOONAR_LDAP_SERVER_REAL")
        )
        bind_dn = (
            get_ldap_setting("LOONAR_LDAP_BIND_DN_MOCK")
            if ldap_mode == "mock"
            else get_ldap_setting("LOONAR_LDAP_BIND_DN_REAL")
        )
        bind_password = (
            get_ldap_setting("LOONAR_LDAP_BIND_PASSWORD_MOCK")
            if ldap_mode == "mock"
            else get_ldap_setting("LOONAR_LDAP_BIND_PASSWORD_REAL")
        )
        use_ssl = (
            get_ldap_setting("LOONAR_LDAP_USE_SSL_MOCK", "false")
            if ldap_mode == "mock"
            else get_ldap_setting("LOONAR_LDAP_USE_SSL_REAL", "false")
        ).lower() == "true"
        if not server_uri or not bind_dn or not bind_password:
            logger.warning(
                "Configurações LDAP incompletas: server_uri=%s, bind_dn=%s",
                bool(server_uri),
                bool(bind_dn),
            )
            return None

        try:
            server = Server(server_uri, use_ssl=use_ssl, get_info=ALL)
            return Connection(
                server,
                user=bind_dn,
                password=bind_password,
                auto_bind=True,
                check_names=False,
            )
        except LDAPException as ex:
            logger.error(
                "Não foi possível conectar ao servidor LDAP %s: %s",
                server_uri,
                str(ex),
                exc_info=True,
            )
            return None
        except Exception as ex:
            logger.error(
                "Erro inesperado ao conectar ao servidor LDAP %s: %s",
                server_uri,
                str(ex),
                exc_info=True,
            )
            return None

    def _lookup_user_dn(
        self,
        connection: Connection,
        username: str,
        selected_ldap_user_base: Optional[str] = None,
    ) -> Optional[str]:
        base_dn = selected_ldap_user_base or self.ldap_user_base or self.ldap_group_base
        if not base_dn:
            return None
        safe_uid = escape_filter_chars(username)
        search_filter = f"(&({self.ldap_uid_attr}={safe_uid})(objectClass=person))"
        connection.search(
            search_base=base_dn,
            search_filter=search_filter,
            search_scope=SUBTREE,
            attributes=["distinguishedName"],
        )
        if not connection.entries:
            return None
        return connection.entries[0].entry_dn

    def _fetch_group_names(self, connection: Connection, user_dn: str) -> List[str]:
        if not self.ldap_group_base:
            return []
        safe_dn = escape_filter_chars(user_dn)
        connection.search(
            search_base=self.ldap_group_base,
            search_filter=(
                f"(&(member={safe_dn})(|(objectClass=group)(objectClass=groupOfNames)))"
            ),
            search_scope=SUBTREE,
            attributes=["cn"],
        )
        return [entry.cn.value for entry in connection.entries if hasattr(entry, "cn")]

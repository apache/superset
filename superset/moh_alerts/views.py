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
"""Administrative UI for the MoH hierarchical alert service (Section 12).

Route group /moh/alerts, gated to administrators. Provides listing, create/
edit, dry-run (test), run-now and delivery-history pages.

This module is imported by ``superset_config.py`` during config loading, at
which point the SQLAlchemy models cannot be imported yet (the encryption
factory is not initialized). All model/db/task access therefore happens
inside functions via the ``_load_*`` helpers.
"""

from __future__ import annotations

import logging
from typing import Any, TYPE_CHECKING

from flask import Blueprint, current_app, redirect, render_template, request, url_for
from flask_login import current_user
from sqlalchemy import text

from superset.moh_alerts.connection import get_moh_database
from superset.utils import json

if TYPE_CHECKING:
    pass

logger = logging.getLogger(__name__)

moh_alerts_bp = Blueprint(
    "moh_alerts",
    __name__,
    url_prefix="/moh/alerts",
    template_folder="templates",
)


def _load_db():
    from superset.extensions import db  # pylint: disable=import-outside-toplevel

    return db


def _load_models():
    from superset.models.moh_alert import (  # pylint: disable=import-outside-toplevel
        MohAlert,
        MohAlertDelivery,
        MohAlertDeliveryRecipient,
    )

    return MohAlert, MohAlertDelivery, MohAlertDeliveryRecipient


def _load_database_model():
    from superset.models.core import Database  # pylint: disable=import-outside-toplevel

    return Database


def _load_resolve():
    from superset.moh_alerts.recipient_resolver import resolve  # noqa: PLC0415

    return resolve


def _load_execute():
    from superset.moh_alerts.tasks import execute  # noqa: PLC0415

    return execute


def _require_admin() -> bool:
    if not getattr(current_user, "is_authenticated", False):
        return False
    return current_app.appbuilder.sm.is_admin()


def _denied():
    if not getattr(current_user, "is_authenticated", False):
        return redirect("/login/")
    return render_template("moh_alerts/denied.html"), 403


@moh_alerts_bp.route("/")
def list_alerts():
    if not _require_admin():
        return _denied()
    db = _load_db()
    alert_model, _, _ = _load_models()
    alerts = db.session.query(alert_model).order_by(alert_model.id).all()
    return render_template("moh_alerts/list.html", alerts=alerts)


@moh_alerts_bp.route("/new", methods=["GET", "POST"])
@moh_alerts_bp.route("/<int:alert_id>/edit", methods=["GET", "POST"])
def upsert(alert_id: int | None = None):
    if not _require_admin():
        return _denied()
    db = _load_db()
    database_model = _load_database_model()
    alert_model, _, _ = _load_models()
    databases = db.session.query(database_model).all()

    alert = db.session.get(alert_model, alert_id) if alert_id else alert_model()

    if request.method == "POST":
        alert.name = request.form.get("name") or alert.name
        alert.description = request.form.get("description") or None
        alert.enabled = bool(request.form.get("enabled"))
        alert.database_id = int(request.form.get("database_id") or alert.database_id)
        alert.sql_query = request.form.get("sql_query") or alert.sql_query
        alert.crontab = request.form.get("crontab") or alert.crontab
        alert.timezone = request.form.get("timezone") or "Africa/Addis_Ababa"
        alert.grace_period = int(request.form.get("grace_period") or 14400)
        alert.working_timeout = int(request.form.get("working_timeout") or 120)
        alert.dashboard_id = (
            int(request.form["dashboard_id"])
            if request.form.get("dashboard_id")
            else None
        )
        alert.subject_template = request.form.get("subject_template") or None
        extra = json.loads(request.form.get("html_extra") or "{}")
        message = (request.form.get("message") or "").strip()
        if message:
            extra["message"] = message
        else:
            extra.pop("message", None)
        alert.html_extra = json.dumps(extra)
        alert.owner_id = (
            int(request.form["owner_id"]) if request.form.get("owner_id") else None
        )
        db.session.add(alert)
        db.session.commit()
        return redirect(url_for("moh_alerts.list_alerts"))

    return render_template(
        "moh_alerts/form.html",
        alert=alert,
        databases=databases,
        is_new=alert_id is None,
        extra=json.loads(alert.html_extra or "{}"),
    )


@moh_alerts_bp.route("/<int:alert_id>/toggle", methods=["POST"])
def toggle(alert_id: int):
    if not _require_admin():
        return _denied()
    db = _load_db()
    alert_model, _, _ = _load_models()
    alert = db.session.get(alert_model, alert_id)
    if alert:
        alert.enabled = not alert.enabled
        db.session.commit()
    return redirect(url_for("moh_alerts.list_alerts"))


@moh_alerts_bp.route("/<int:alert_id>/run", methods=["POST"])
def run_now(alert_id: int):
    if not _require_admin():
        return _denied()
    db = _load_db()
    alert_model, _, _ = _load_models()
    execute = _load_execute()
    alert = db.session.get(alert_model, alert_id)
    if alert:
        execute.apply_async((alert.id,))
        logger.info("moh alert %s run-now dispatched", alert_id)
    return redirect(url_for("moh_alerts.list_alerts"))


@moh_alerts_bp.route("/<int:alert_id>/test", methods=["POST"])
def test(alert_id: int):
    if not _require_admin():
        return _denied()
    db = _load_db()
    alert_model, _, _ = _load_models()
    databases = db.session.query(_load_database_model()).all()
    alert = db.session.get(alert_model, alert_id)
    if alert is None:
        return redirect(url_for("moh_alerts.list_alerts"))

    # Dry-run: evaluate + resolve recipients, never send.
    result: dict[str, Any] = {"alert": alert, "databases": databases, "test": None}
    try:
        database = get_moh_database(alert.database_id)
        with database.get_sqla_engine() as engine:
            with engine.connect() as conn:
                rows = [dict(r) for r in conn.execute(text(alert.sql_query)).mappings()]
        valid = [r for r in rows if r.get("org_unit_id")]
        seen = {}
        for r in valid:
            seen.setdefault(str(r["org_unit_id"]), r)

        schema = current_app.config.get("MOH_ORG_UNITS_SCHEMA", "moh")
        org_table = current_app.config.get("MOH_ORG_UNITS_TABLE", "org_units")
        user_table = current_app.config.get(
            "MOH_USER_ORG_UNITS_TABLE", "dim_user_orgunit"
        )
        per_user, ignored = _load_resolve()(
            database,
            seen.keys(),
            schema=schema,
            org_units_table=org_table,
            user_org_units_table=user_table,
        )
        result["test"] = {
            "facilities": len(seen),
            "ignored": ignored,
            "recipients": {
                username: len(facilities) for username, facilities in per_user.items()
            },
        }
    except Exception as ex:  # pylint: disable=broad-except
        result["test"] = {"error": f"{type(ex).__name__}: {ex}"}

    return render_template("moh_alerts/form.html", **result)


@moh_alerts_bp.route("/<int:alert_id>/deliveries")
def deliveries(alert_id: int):
    if not _require_admin():
        return _denied()
    db = _load_db()
    alert_model, delivery_model, _ = _load_models()
    alert = db.session.get(alert_model, alert_id)
    if alert is None:
        return redirect(url_for("moh_alerts.list_alerts"))
    rows = (
        db.session.query(delivery_model)
        .filter(delivery_model.alert_id == alert_id)
        .order_by(delivery_model.started_at.desc())
        .all()
    )
    return render_template("moh_alerts/deliveries.html", alert=alert, rows=rows)

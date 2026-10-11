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
"""
AI insights for dashboard charts — a compact per-chart narrative shown beside
each chart in the Health Intelligence dashboard.

POST /ai-insights/chart/<chart_id>/
    Accepts a small JSON payload summarised client-side from the chart's latest
    query results (the frontend already has the data, so no query is re-run
    server-side):

        {
          "chart_id": 153,
          "chart_name": "OPD attendance by woreda",
          "viz_type": "echarts_timeseries_bar",
          "dashboard_id": 8,
          "summary": {
            "row_count": 231,
            "columns": ["period", "value"],
            "numeric_stats": [
              {"column": "value", "min": 12.0, "max": 480.0,
               "avg": 156.4, "count": 231}
            ],
            "top_values": [
              {"column": "ow", "values": [{"value": "AA", "count": 44}],
               "total": 120}
            ],
            "trend": {
              "column": "value", "direction": "increasing",
              "start": 41.0, "end": 388.0,
              "first_label": "2025-01", "last_label": "2026-08"
            }
          },
          "sample_rows": [{"period": "2025-01", "value": 41.0}]
        }

    The insight is generated with a real LLM provider (openai | gemini |
    claude) when MOH_AI_INSIGHTS_PROVIDER and MOH_AI_INSIGHTS_API_KEY are
    configured, otherwise a deterministic template-based generator runs so the
    feature works without any external credentials (hybrid mode).

    Responses are cached in-process keyed on (chart id + payload hash) so
    re-renders after a data refresh do not re-pay the LLM cost.

    The caller must be able to see the chart (directly, or through a dashboard
    that contains it). Chart name and type come from the database, not the
    request. LLM calls per user are capped; above the cap the template
    generator answers instead.

Registered with Flask via the BLUEPRINTS list in superset_config.py — no
edits to upstream Superset init code.
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import time
from collections import deque, OrderedDict
from typing import Any

import requests
from flask import Blueprint, current_app, g, has_app_context, jsonify, request
from flask_login import login_required

from superset.exceptions import SupersetSecurityException
from superset.extensions import db, security_manager
from superset.superset_typing import FlaskResponse

logger = logging.getLogger(__name__)

ai_insights_bp = Blueprint("moh_ai_insights", __name__)

# In-process cache: cache_key -> (expiry_ts, payload), oldest entries evicted
# first once MOH_AI_INSIGHTS_CACHE_MAX_ENTRIES is reached. Per Gunicorn worker;
# swap for Redis if the app is scaled horizontally.
_CACHE: OrderedDict[str, tuple[float, dict[str, Any]]] = OrderedDict()
# user id -> timestamps of that user's LLM calls in the last hour (per worker)
_LLM_CALLS: dict[int, deque[float]] = {}

_MAX_SAMPLE_ROWS = 40
_MAX_LLM_TEXT_CHARS = 6000
_MAX_CELL_CHARS = 200
_MAX_REQUEST_BYTES = 64 * 1024
_DEFAULT_MODELS = {
    "openai": "gpt-4o-mini",
    "gemini": "gemini-1.5-flash",
    "claude": "claude-3-5-haiku-latest",
}

_PROVIDER_ENDPOINTS = {
    "openai": "https://api.openai.com/v1/chat/completions",
    "gemini": ("https://generativelanguage.googleapis.com/v1beta/models/"
               "{model}:generateContent"),
    "claude": "https://api.anthropic.com/v1/messages",
}


def _config(name: str, default: object = "") -> object:
    """Read from Flask config first, then fall back to the environment."""
    if has_app_context() and current_app.config.get(name) is not None:
        return current_app.config.get(name, default)
    return os.environ.get(name, default)


def _int_config(name: str, default: int) -> int:
    try:
        return int(str(_config(name, default)))
    except (TypeError, ValueError):
        return default


def _provider() -> str:
    return str(_config("MOH_AI_INSIGHTS_PROVIDER", "")).strip().lower()


def _api_key() -> str:
    return str(_config("MOH_AI_INSIGHTS_API_KEY", "")).strip()


def _model() -> str:
    value = str(_config("MOH_AI_INSIGHTS_MODEL", "")).strip()
    if value:
        return value
    return _DEFAULT_MODELS.get(_provider(), "")


def _timeout() -> int:
    return _int_config("MOH_AI_INSIGHTS_TIMEOUT", 20)


def _cache_ttl() -> int:
    # Keep generated chart insights warm for at least 2 weeks so dashboard
    # re-renders and repeated visits do not trigger repeated LLM calls.
    return _int_config("MOH_AI_INSIGHTS_CACHE_TTL", 14 * 24 * 60 * 60)


def _cache_max_entries() -> int:
    return _int_config("MOH_AI_INSIGHTS_CACHE_MAX_ENTRIES", 2000)


def _user_llm_calls_per_hour() -> int:
    return _int_config("MOH_AI_INSIGHTS_USER_LLM_PER_HOUR", 60)


def _insights_enabled() -> bool:
    raw = _config("MOH_AI_INSIGHTS_ENABLED", True)
    if isinstance(raw, str):
        return raw.strip().lower() in {"1", "true", "yes", "on"}
    return bool(raw)


# ---------------------------------------------------------------------------
# Deterministic, template-based generator (the "demo" provider)
# ---------------------------------------------------------------------------

def _format_number(value: float | int | None) -> str:
    if value is None:
        return "?"
    try:
        number = float(value)
    except (TypeError, ValueError):
        return "?"
    if number.is_integer():
        return f"{int(number):,}"
    return f"{number:,.1f}"


def _direction_word(direction: str) -> str:
    return {
        "increasing": "increased",
        "decreasing": "decreased",
        "stable": "stayed roughly level",
    }.get(direction, "trended")


def _generate_demo_insight(
    summary: dict[str, Any], sample_rows: list[Any]
) -> dict[str, Any]:
    """Build a deterministic insight: a headline summary, one action sentence, and short bullets."""
    columns = summary.get("columns") or []
    row_count = summary.get("row_count")
    numeric_stats = summary.get("numeric_stats") or []
    trend = summary.get("trend") or {}
    top_values = summary.get("top_values") or []

    summary_lines: list[str] = []
    bullets: list[str] = []

    if isinstance(row_count, (int, float)):
        noun = "row" if int(row_count) == 1 else "rows"
        cols_txt = f" across {len(columns)} columns" if columns else ""
        summary_lines.append(
            f"This chart covers {row_count:,} {noun} of data{cols_txt}."
        )

    for stat in numeric_stats[:2]:
        column = stat.get("column", "value")
        metric_range = (
            f"{column.capitalize()} ranges from {_format_number(stat.get('min'))} "
            f"to {_format_number(stat.get('max'))}"
        )
        avg = stat.get("avg")
        avg_txt = (
            f" with an average of {_format_number(avg)}" if avg is not None else ""
        )
        bullets.append(f"{metric_range}{avg_txt}.")

    if trend.get("direction") and trend.get("column"):
        start = _format_number(trend.get("start"))
        end = _format_number(trend.get("end"))
        first = trend.get("first_label")
        last = trend.get("last_label")
        period_txt = (
            f" from {first} to {last}" if first is not None and last is not None else ""
        )
        bullets.append(
            f"{trend.get('column')} {_direction_word(str(trend.get('direction')))} "
            f"from {start} to {end}{period_txt}."
        )

    recommendation = "Recommendation: continue monitoring this pattern and act only if the recent trend changes materially."
    for top in top_values[:1]:
        values = top.get("values") or []
        if values:
            leader = values[0]
            total = top.get("total")
            pct = (
                f" ({int(leader.get('count', 0)) / int(total) * 100:.0f}% of all records)"
                if total else ""
            )
            bullets.append(
                f"The leading {top.get('column', 'category')} is {leader.get('value')} "
                f"with {leader.get('count')} records{pct}."
            )
            recommendation = (
                f"Recommendation: focus follow-up on {leader.get('value')} and the leading "
                f"{top.get('column', 'category')} segment to sustain the strongest current performance."
            )

    if trend.get("direction") == "decreasing":
        recommendation = (
            "Recommendation: investigate the recent decline and prioritize corrective action "
            "before it affects service delivery or target attainment."
        )
    elif trend.get("direction") == "increasing":
        recommendation = (
            "Recommendation: keep the current operating focus and consider channeling additional "
            "resources to the strongest recent periods to sustain the upward trend."
        )
    elif trend.get("direction") == "stable":
        recommendation = (
            "Recommendation: maintain the current approach while monitoring for early volatility "
            "so the stable pattern does not slip into decline."
        )

    summary_text = " ".join(summary_lines[:2])
    if not summary_text and bullets:
        summary_text = bullets.pop(0)
    if not summary_text:
        summary_text = (
            "This chart returned no data. Check the active filters or refresh the dashboard."
        )

    return {
        "summary": summary_text,
        "recommendation": recommendation,
        "bullets": bullets[:4],
    }


# ---------------------------------------------------------------------------
# LLM providers
# ---------------------------------------------------------------------------

def _build_llm_prompt(
    chart_name: str,
    viz_type: str,
    summary: dict[str, Any],
    sample_rows: list[Any],
) -> str:
    compact = json.dumps(
        summary, sort_keys=True, default=str, ensure_ascii=True
    )
    prompt = (
        "You are an expert public-health data analyst writing a short AI insight "
        "for a chart inside a Ministry of Health dashboard.\n\n"
        f"Chart name: {chart_name}\n"
        f"Chart type: {viz_type}\n\n"
        f"Summary of the latest query:\n{compact}\n\n"
        f"Sample rows (first {len(sample_rows)}):\n"
        f"{json.dumps(sample_rows, sort_keys=True, default=str, ensure_ascii=True)}\n\n"
        'Return ONLY a JSON object with exactly this shape (no markdown, no '
        "extra text):\n"
        '{\n'
        '  "summary": "1 short sentence describing what the chart is about and the data it shows",\n'
        '  "recommendation": "1 short sentence with one concrete action based on the data",\n'
        '  "bullets": [\n'
        '    "short insight 1",\n'
        '    "short insight 2",\n'
        '    "short insight 3",\n'
        '  ]\n'
        "}\n"
        "Rules:\n"
        "- summary: 1 short sentence explaining what the chart is about and what kind of data it provides, including the main metric, group, or trend it represents.\n"
        "- recommendation: 1 short sentence with one clear recommendation or action for the team.\n"
        "- bullets: 3 very concise, one-line insights on the most notable patterns, "
        "outliers, and implications for health decision-makers.\n"
        "- Use plain text only inside the strings; no markdown, no headings, no "
        "extra keys."
    )
    return prompt


def _ask_openai(prompt: str, api_key: str, model: str, timeout: int) -> str:
    resp = requests.post(
        _PROVIDER_ENDPOINTS["openai"],
        headers={"Authorization": f"Bearer {api_key}"},
        json={
            "model": model,
            "messages": [
                {
                    "role": "system",
                    "content": "You produce concise, accurate data insights.",
                },
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.3,
            "max_tokens": 250,
        },
        timeout=timeout,
    )
    resp.raise_for_status()
    return str(resp.json()["choices"][0]["message"]["content"]).strip()


def _ask_gemini(prompt: str, api_key: str, model: str, timeout: int) -> str:
    url = _PROVIDER_ENDPOINTS["gemini"].format(model=model)
    resp = requests.post(
        url,
        headers={"x-goog-api-key": api_key},
        json={
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": prompt}],
                }
            ]
        },
        timeout=timeout,
    )
    resp.raise_for_status()
    parts = resp.json()["candidates"][0]["content"]["parts"]
    return "".join(part.get("text", "") for part in parts).strip()


def _ask_claude(prompt: str, api_key: str, model: str, timeout: int) -> str:
    resp = requests.post(
        _PROVIDER_ENDPOINTS["claude"],
        headers={
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
        },
        json={
            "model": model,
            "max_tokens": 300,
            "messages": [{"role": "user", "content": prompt}],
        },
        timeout=timeout,
    )
    resp.raise_for_status()
    chunks = resp.json().get("content") or []
    return "".join(
        str(part.get("text", ""))
        for part in chunks
        if isinstance(part, dict) and part.get("type") == "text"
    ).strip()


def _ask_llm(
    provider: str,
    api_key: str,
    model: str,
    prompt: str,
    timeout: int,
) -> str:
    if provider == "openai":
        return _ask_openai(prompt, api_key, model, timeout)
    if provider == "gemini":
        return _ask_gemini(prompt, api_key, model, timeout)
    if provider in {"claude", "anthropic"}:
        return _ask_claude(prompt, api_key, model, timeout)
    raise ValueError(f"Unsupported AI insights provider: {provider}")


def _parse_llm_insight(text: str) -> dict[str, Any] | None:
    """Extract {summary, recommendation, bullets} from an LLM JSON response.

    The LLM is asked to return a JSON object shaped
    {"summary": str, "recommendation": str, "bullets": [str, ...]}.
    Tolerates stray markdown code fences and returns None if the text can't be
    parsed into that shape so the caller can fall back to the demo generator.
    """
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```[a-z]*\s*", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        data = json.loads(cleaned)
    except (TypeError, ValueError):
        return None
    if not isinstance(data, dict):
        return None
    summary = data.get("summary")
    recommendation = data.get("recommendation")
    raw_bullets = data.get("bullets")
    if not isinstance(summary, str) or not summary.strip():
        return None
    if not isinstance(raw_bullets, list):
        return None
    bullets = [
        str(item).strip()
        for item in raw_bullets
        if isinstance(item, str) and item.strip()
    ]
    recommendation_text = (
        recommendation.strip() if isinstance(recommendation, str) and recommendation.strip() else None
    )
    parsed = {"summary": summary.strip(), "bullets": bullets[:4]}
    if recommendation_text:
        parsed["recommendation"] = recommendation_text
    return parsed


# ---------------------------------------------------------------------------
# Main generator with caching + hybrid fallback
# ---------------------------------------------------------------------------

def _cache_key(chart_id: int, payload: dict[str, Any]) -> str:
    digest = hashlib.sha256(
        json.dumps(payload, sort_keys=True, default=str).encode("utf-8")
    ).hexdigest()
    return f"moh_ai_insights:{chart_id}:{digest}"


def _llm_budget_ok(user_id: int | None) -> bool:
    """Record one LLM call for the user; False once the hourly cap is reached."""
    if user_id is None:
        return False
    now = time.time()
    calls = _LLM_CALLS.setdefault(user_id, deque())
    while calls and calls[0] < now - 3600:
        calls.popleft()
    if len(calls) >= _user_llm_calls_per_hour():
        return False
    calls.append(now)
    return True


def _generate_insight(
    chart_id: int,
    chart_name: str,
    viz_type: str,
    summary: dict[str, Any],
    sample_rows: list[Any],
    user_id: int | None = None,
) -> dict[str, Any]:
    """Return {summary, recommendation, bullets, provider} — LLM when configured, else demo."""
    demo = _generate_demo_insight(summary, sample_rows)
    provider = _provider()
    api_key = _api_key()

    if provider in _PROVIDER_ENDPOINTS and api_key and _llm_budget_ok(user_id):
        prompt = _build_llm_prompt(chart_name, viz_type, summary, sample_rows)
        try:
            raw = _ask_llm(
                provider,
                api_key,
                _model(),
                prompt,
                _timeout(),
            )
            structured = _parse_llm_insight(raw) if raw else None
            if structured:
                return {**structured, "provider": provider}
        except Exception as ex:  # noqa: BLE001 - fall back to demo on any LLM failure
            # no traceback or exception text: they can contain the request URL
            status = getattr(getattr(ex, "response", None), "status_code", "")
            logger.warning(
                "AI insights LLM call failed for chart %s (%s): %s %s; using demo "
                "fallback",
                chart_id,
                provider,
                type(ex).__name__,
                status,
            )

    return {**demo, "provider": "demo"}


def _cap_cell(value: Any) -> Any:
    if isinstance(value, str):
        return value[:_MAX_CELL_CHARS]
    if isinstance(value, (int, float, bool)) or value is None:
        return value
    return str(value)[:_MAX_CELL_CHARS]


def _accessible_chart(chart_id: int, dashboard_id: Any) -> Any:
    """Return the chart if the current user may see it, else None.

    Allowed when the user can access the chart's dataset, or can access a
    dashboard that contains the chart (dashboard-only viewers).
    """
    from superset.models.dashboard import Dashboard
    from superset.models.slice import Slice

    chart = db.session.get(Slice, chart_id)
    if chart is None:
        return None
    if security_manager.can_access_chart(chart):
        return chart
    try:
        dashboard = db.session.get(Dashboard, int(dashboard_id))
    except (TypeError, ValueError):
        return None
    if dashboard is None or chart not in dashboard.slices:
        return None
    try:
        security_manager.raise_for_access(dashboard=dashboard)
    except SupersetSecurityException:
        return None
    return chart


@ai_insights_bp.route("/ai-insights/chart/<int:chart_id>/", methods=["POST"])
@login_required
def generate_chart_insight(chart_id: int) -> FlaskResponse:
    """Generate (and cache) an AI insight for one chart on a dashboard.

    ---
    post:
      summary: Generate an AI insight for a dashboard chart
      parameters:
      - name: chart_id
        in: path
        required: true
        schema: {type: integer}
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                chart_name: {type: string}
                viz_type: {type: string}
                dashboard_id: {type: integer}
                summary: {type: object}
                sample_rows: {type: array}
      responses:
200:
           description: Generated insight
           content:
             application/json:
               schema:
                 type: object
                 properties:
                   chart_id: {type: integer}
                   chart_name: {type: string}
                   dashboard_id: {type: integer}
                   summary: {type: string}
                   bullets:
                     type: array
                     items: {type: string}
                   provider: {type: string}
                   generated_at: {type: string}
                   cached: {type: boolean}
        404:
          description: AI insights are disabled
    """
    if not _insights_enabled():
        return jsonify({"error": "AI insights are disabled"}), 404

    if (request.content_length or 0) > _MAX_REQUEST_BYTES:
        return jsonify({"error": "Payload too large"}), 413

    payload = request.get_json(silent=True) or {}
    if not isinstance(payload, dict):
        return jsonify({"error": "Invalid JSON payload"}), 400

    dashboard_id = payload.get("dashboard_id")
    chart = _accessible_chart(chart_id, dashboard_id)
    if chart is None:
        return jsonify({"error": "Chart not found"}), 404
    chart_name = str(chart.slice_name or "Chart").strip()
    viz_type = str(chart.viz_type or "chart").strip()
    summary = payload.get("summary")
    sample_rows = payload.get("sample_rows")

    if not isinstance(summary, dict):
        return jsonify({"error": "Missing chart data summary"}), 400

    if sample_rows is None:
        sample_rows = []
    if not isinstance(sample_rows, list):
        return jsonify({"error": "Invalid sample rows"}), 400
    try:
        sample_rows = [
            {str(k)[:_MAX_CELL_CHARS]: _cap_cell(v) for k, v in row.items()}
            for row in sample_rows[:_MAX_SAMPLE_ROWS]
            if isinstance(row, dict)
        ]
        summary = json.loads(
            json.dumps(summary, default=str)[:_MAX_LLM_TEXT_CHARS]
        )
    except (TypeError, ValueError):
        return jsonify({"error": "Invalid summary payload"}), 400

    request_payload = {
        "chart_name": chart_name,
        "viz_type": viz_type,
        "summary": summary,
        "sample_rows": sample_rows,
    }
    cache_key = _cache_key(chart_id, request_payload)
    now = time.time()

    cached = _CACHE.get(cache_key)
    if cached and cached[0] > now:
        _CACHE.move_to_end(cache_key)
        return jsonify({**cached[1], "cached": True})

    result = _generate_insight(
        chart_id,
        chart_name,
        viz_type,
        summary,
        sample_rows,
        user_id=getattr(getattr(g, "user", None), "id", None),
    )
    generated_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    response_payload = {
        "chart_id": chart_id,
        "chart_name": chart_name,
        "dashboard_id": dashboard_id,
        "summary": result["summary"],
        "recommendation": result.get("recommendation"),
        "bullets": result["bullets"],
        "provider": result["provider"],
        "generated_at": generated_at,
        "cached": False,
    }
    _CACHE[cache_key] = (now + _cache_ttl(), response_payload)
    while len(_CACHE) > _cache_max_entries():
        _CACHE.popitem(last=False)
    return jsonify(response_payload)
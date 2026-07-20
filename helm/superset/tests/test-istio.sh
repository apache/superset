#!/usr/bin/env bash
#
# Licensed to the Apache Software Foundation (ASF) under one or more
# contributor license agreements.  See the NOTICE file distributed with
# this work for additional information regarding copyright ownership.
# The ASF licenses this file to You under the Apache License, Version 2.0
# (the "License"); you may not use this file except in compliance with
# the License.  You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#
# Renders the chart with `helm template` for several `init.istio.*` value
# combinations and asserts that the relevant manifests contain (or omit)
# the expected fields. Intended to be run from the chart directory or via
# `bash helm/superset/tests/test-istio.sh` from the repo root.
#
# Covers the fix for:
#   https://github.com/apache/superset/issues/25798
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHART_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

pass=0
fail=0

assert_contains() {
    local label="$1"
    local needle="$2"
    local haystack="$3"
    if grep -qF -- "${needle}" <<<"${haystack}"; then
        echo "  PASS: ${label}"
        pass=$((pass + 1))
    else
        echo "  FAIL: ${label}"
        echo "    expected to contain: ${needle}"
        fail=$((fail + 1))
    fi
}

assert_not_contains() {
    local label="$1"
    local needle="$2"
    local haystack="$3"
    if ! grep -qF -- "${needle}" <<<"${haystack}"; then
        echo "  PASS: ${label}"
        pass=$((pass + 1))
    else
        echo "  FAIL: ${label}"
        echo "    expected NOT to contain: ${needle}"
        fail=$((fail + 1))
    fi
}

render() {
    helm template release "${CHART_DIR}" "$@"
}

extract_init_job() {
    awk '
        /^# Source: superset\/templates\/init-job\.yaml/ { capture = 1 }
        capture && /^---$/ { capture = 0 }
        capture { print }
    ' <<<"$1"
}

extract_config_secret() {
    awk '
        /^# Source: superset\/templates\/secret-superset-config\.yaml/ { capture = 1 }
        capture && /^---$/ { capture = 0 }
        capture { print }
    ' <<<"$1"
}

echo "==> defaults: no istio mitigations applied"
out_default="$(render)"
init_job_default="$(extract_init_job "${out_default}")"
config_default="$(extract_config_secret "${out_default}")"
assert_not_contains "default does not set sidecar.istio.io/inject label" \
    'sidecar.istio.io/inject' "${init_job_default}"
assert_not_contains "default initscript does not register quitquitquit trap" \
    'quitquitquit' "${config_default}"

echo "==> init.istio.disableSidecarInjection=true"
out_disable="$(render --set init.istio.disableSidecarInjection=true)"
init_job_disable="$(extract_init_job "${out_disable}")"
config_disable="$(extract_config_secret "${out_disable}")"
assert_contains "init job sets sidecar.istio.io/inject: \"false\"" \
    'sidecar.istio.io/inject: "false"' "${init_job_disable}"
assert_not_contains "disableSidecarInjection alone does not add quitquitquit trap" \
    'quitquitquit' "${config_disable}"

echo "==> init.istio.terminateSidecarOnExit=true"
out_terminate="$(render --set init.istio.terminateSidecarOnExit=true)"
init_job_terminate="$(extract_init_job "${out_terminate}")"
config_terminate="$(extract_config_secret "${out_terminate}")"
assert_not_contains "terminateSidecarOnExit alone does not add inject label" \
    'sidecar.istio.io/inject' "${init_job_terminate}"
assert_contains "initscript registers EXIT trap that calls quitquitquit" \
    "trap 'rc=\$?; curl -fsS -m 5 -X POST" "${config_terminate}"
assert_contains "initscript trap targets the configured quit endpoint" \
    'http://localhost:15020/quitquitquit' "${config_terminate}"
assert_contains "initscript trap binds to the EXIT signal" \
    "' EXIT" "${config_terminate}"

echo "==> init.istio.quitEndpoint override"
out_endpoint="$(render --set init.istio.terminateSidecarOnExit=true \
    --set init.istio.quitEndpoint=http://127.0.0.1:15020/quitquitquit)"
config_endpoint="$(extract_config_secret "${out_endpoint}")"
assert_contains "trap honours custom quitEndpoint" \
    'http://127.0.0.1:15020/quitquitquit' "${config_endpoint}"

echo "==> both options combined"
out_both="$(render --set init.istio.disableSidecarInjection=true \
    --set init.istio.terminateSidecarOnExit=true)"
init_job_both="$(extract_init_job "${out_both}")"
config_both="$(extract_config_secret "${out_both}")"
assert_contains "combined: inject label present" \
    'sidecar.istio.io/inject: "false"' "${init_job_both}"
assert_contains "combined: trap present" \
    'quitquitquit' "${config_both}"

echo "==> existing init.podLabels are preserved alongside istio label"
out_labels="$(render --set init.istio.disableSidecarInjection=true \
    --set init.podLabels.team=data-platform)"
init_job_labels="$(extract_init_job "${out_labels}")"
assert_contains "user-supplied podLabel still rendered" \
    'team: data-platform' "${init_job_labels}"
assert_contains "istio inject label rendered alongside" \
    'sidecar.istio.io/inject: "false"' "${init_job_labels}"

echo "==> init.istio explicitly overridden to null"
out_null_istio="$(render --set init.istio=null)"
init_job_null_istio="$(extract_init_job "${out_null_istio}")"
config_null_istio="$(extract_config_secret "${out_null_istio}")"
assert_not_contains "null init.istio does not set inject label" \
    'sidecar.istio.io/inject' "${init_job_null_istio}"
assert_not_contains "null init.istio does not register quitquitquit trap" \
    'quitquitquit' "${config_null_istio}"

echo "==> EXIT trap propagates the script's exit code, not the notification's"
# The trap's own curl call is best-effort (failures are logged with
# `|| echo ... >&2`, not swallowed with `|| true`) and must not mask a
# failed migration. Extract the two rendered lines and actually run them,
# with curl pointed at a closed local port so the notification itself fails,
# to make sure the wrapped script's real exit code still comes through.
quit_endpoint_line="$(grep -F 'ISTIO_QUIT_ENDPOINT=' <<<"${config_terminate}" || true)"
trap_line="$(grep -F "trap 'rc=\$?; curl" <<<"${config_terminate}" || true)"
if [[ -z "${quit_endpoint_line}" || -z "${trap_line}" ]]; then
    echo "  FAIL: script exit code (42) survives a failing quitquitquit notification"
    echo "    could not locate the rendered ISTIO_QUIT_ENDPOINT/trap lines to exercise"
    fail=$((fail + 1))
else
    set +e
    (
        eval "${quit_endpoint_line}"
        ISTIO_QUIT_ENDPOINT="http://127.0.0.1:1/quitquitquit"
        eval "${trap_line}"
        exit 42
    )
    trap_test_rc=$?
    set -e
    if [[ "${trap_test_rc}" -eq 42 ]]; then
        echo "  PASS: script exit code (42) survives a failing quitquitquit notification"
        pass=$((pass + 1))
    else
        echo "  FAIL: script exit code (42) survives a failing quitquitquit notification"
        echo "    got exit code: ${trap_test_rc}"
        fail=$((fail + 1))
    fi
fi

echo
echo "passed: ${pass}, failed: ${fail}"
if [[ ${fail} -gt 0 ]]; then
    exit 1
fi

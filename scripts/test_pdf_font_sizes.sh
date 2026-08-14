#!/usr/bin/env bash
# test_pdf_font_sizes.sh
#
# Generates three PDFs from dashboard 10 — one per font-size tier — copies
# them to ~/Desktop, and opens them so you can visually compare side-by-side.
#
# Run from the repo root:
#   bash scripts/test_pdf_font_sizes.sh
#
# Requirements:
#   - Docker Compose stack running (superset-superset-1 container up)
#   - DASHBOARD_REPORTS_BROWSER_PRINT_PDF=True and
#     PLAYWRIGHT_REPORTS_AND_THUMBNAILS=True in
#     docker/pythonpath_dev/superset_config_docker.py
#   - npm run build already run (or run with --build flag below)
#
# Usage:
#   bash scripts/test_pdf_font_sizes.sh          # use existing bundle
#   bash scripts/test_pdf_font_sizes.sh --build  # rebuild frontend first

set -euo pipefail

CONTAINER="superset-superset-1"
DESKTOP="$HOME/Desktop"

# ── optional frontend rebuild ─────────────────────────────────────────────────
if [[ "${1:-}" == "--build" ]]; then
  echo ">>> Rebuilding frontend bundle..."
  cd superset-frontend
  npm run build
  cd ..
  echo ">>> Frontend build complete."
fi

# ── write Python test script to a temp file ──────────────────────────────────
cat > /tmp/_sip212_test.py << 'PYEOF'
import sys, os, time
sys.path.insert(0, "/app")
os.environ.setdefault("FLASK_ENV", "development")

from superset import create_app
flask_app = create_app()

with flask_app.app_context():
    from superset import db
    from superset.utils.screenshots import DashboardPrintScreenshot
    from superset.utils.webdriver import WindowSize
    from superset.models.dashboard import Dashboard
    from flask_appbuilder.security.sqla.models import User

    dashboard = db.session.query(Dashboard).filter_by(id=10).one()
    user = db.session.query(User).filter_by(username='admin').first()

    # Use the internal Docker hostname — 'localhost' does not resolve
    # to the Superset web container from inside the container itself.
    base_url = "http://superset:8088/superset/dashboard/large-table-pdf-test/"
    window_size: WindowSize = (1600, 1200)

    for font_size in ("small", "medium", "large"):
        t0 = time.monotonic()
        # 'small' is the no-override tier — no ?print_font_size param added
        shot = DashboardPrintScreenshot(
            base_url,
            dashboard.digest,
            window_size=window_size,
            font_size=None if font_size == "small" else font_size,
        )
        print(f"[{font_size}] URL: {shot.url}", flush=True)
        pdf = shot.get_print_pdf(
            user=user,
            log_context=f"test-{font_size}",
            header_title=dashboard.dashboard_title,
            font_size=None if font_size == "small" else font_size,
        )
        elapsed = time.monotonic() - t0
        if pdf:
            out_path = f"/tmp/test_dash10_pdf_{font_size}.pdf"
            with open(out_path, "wb") as f:
                f.write(pdf)
            print(f"[{font_size}] SUCCESS: {len(pdf):,} bytes in {elapsed:.1f}s -> {out_path}", flush=True)
        else:
            print(f"[{font_size}] FAILED in {elapsed:.1f}s", flush=True)
            sys.exit(1)

    # ── Custom header/footer content test ────────────────────────────────────
    # Demonstrates BROWSER_PRINT_PDF_HEADER_CONTENT / FOOTER_CONTENT override.
    # In production superset_config.py an operator would set these at the module
    # level; here we patch the Flask app config dict directly for the test.
    from superset.utils.webdriver import WebDriverPlaywright
    flask_app.config["BROWSER_PRINT_PDF_HEADER_CONTENT"] = {
        "left":   "{title}",
        "center": "ACME Corp — Internal Use Only",
        "right":  "Printed: {date}",
    }
    flask_app.config["BROWSER_PRINT_PDF_FOOTER_CONTENT"] = {
        "left":   "CONFIDENTIAL · Do not distribute",
        "center": "analytics.acme.com",
        # right is always Page N of M — cannot be overridden
    }
    t0 = time.monotonic()
    shot_custom = DashboardPrintScreenshot(
        base_url,
        dashboard.digest,
        window_size=window_size,
        font_size=None,
    )
    pdf_custom = shot_custom.get_print_pdf(
        user=user,
        log_context="test-custom-header",
        header_title=dashboard.dashboard_title,
        font_size=None,
    )
    elapsed = time.monotonic() - t0
    if pdf_custom:
        with open("/tmp/test_dash10_pdf_custom_header.pdf", "wb") as f:
            f.write(pdf_custom)
        print(f"[custom] SUCCESS: {len(pdf_custom):,} bytes in {elapsed:.1f}s -> /tmp/test_dash10_pdf_custom_header.pdf", flush=True)
    else:
        print(f"[custom] FAILED in {elapsed:.1f}s", flush=True)
        sys.exit(1)

print("All four PDFs generated.", flush=True)
PYEOF

# ── copy script into container and run it ────────────────────────────────────
echo ">>> Generating PDFs inside $CONTAINER ..."
docker cp /tmp/_sip212_test.py "$CONTAINER:/tmp/_sip212_test.py"
docker exec "$CONTAINER" python3 /tmp/_sip212_test.py 2>&1 \
  | grep -E "^\[|^All|ERROR:superset"

# ── copy PDFs to Desktop ──────────────────────────────────────────────────────
echo ">>> Copying PDFs to $DESKTOP ..."
for TIER in small medium large custom_header; do
  docker cp "$CONTAINER:/tmp/test_dash10_pdf_${TIER}.pdf" \
    "$DESKTOP/test_dash10_pdf_${TIER}.pdf"
  echo "    Copied test_dash10_pdf_${TIER}.pdf"
done

# ── open all four ─────────────────────────────────────────────────────────────
echo ">>> Opening PDFs..."
open "$DESKTOP/test_dash10_pdf_small.pdf"
open "$DESKTOP/test_dash10_pdf_medium.pdf"
open "$DESKTOP/test_dash10_pdf_large.pdf"
open "$DESKTOP/test_dash10_pdf_custom_header.pdf"

echo ""
echo "Done. Four PDFs open on your Desktop:"
echo "  test_dash10_pdf_small.pdf         — default   (no font overrides, React defaults)"
echo "  test_dash10_pdf_medium.pdf        — medium    (26px chart titles, 20px table)"
echo "  test_dash10_pdf_large.pdf         — XL        (38px chart titles, 30px table)"
echo "  test_dash10_pdf_custom_header.pdf — custom    (ACME Corp header/footer demo)"
echo ""
echo "To customize header/footer in production, set in superset_config.py:"
echo "  BROWSER_PRINT_PDF_HEADER_CONTENT = {"
echo '    "left":   "{title}",'
echo '    "center": "Your Org Name",'
echo '    "right":  "Printed: {date}",'
echo "  }"
echo "  BROWSER_PRINT_PDF_FOOTER_CONTENT = {"
echo '    "left":   "Confidential",'
echo '    "center": "your-domain.com",'
echo "  }"

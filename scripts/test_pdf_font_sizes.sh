#!/usr/bin/env bash
# test_pdf_font_sizes.sh
#
# Generates PDFs from six dashboards, covering all SIP-212 edge cases:
#
#   - dashboard 10 (Large Table PDF Test)  — 5 variants: small/medium/large/2col/custom
#       EC3 : table with page_length=0 ("All" — 1000 rows, no pagination)
#       EC9 : table with 8 columns (width constraint cleared)
#
#   - dashboard 2  (World Bank's Data)     — 2 variants: small/2col
#       EC5 : sticky-header table (scroll container cleared by JS)
#       layout with table in same row as canvas charts (sibling height released)
#
#   - dashboard 5  (Video Game Sales)      — 1 variant: small
#       EC1 : "Games" table has page_length=15 (client-side pagination)
#             SHOW_ALL_TABLE_ROWS_JS must expand it to show all rows
#
#   - dashboard 6  (Sales Dashboard)       — 2 variants: small/2col
#       EC6 : multi-tab dashboard (two tabs merged via pypdf)
#
#   - dashboard 8  (Misc Charts)           — 2 variants: small/2col
#       EC7 : mixed chart types including empty/error states
#
#   - dashboard 11 (Wide Table PDF Test)   — 2 variants: small/large  [NEW]
#       EC10: table with 44 columns (flights dataset)
#             SCALE_WIDE_TABLES_JS must CSS-scale it to fit A4 width
#
# Copies everything to ~/Desktop and opens it for visual inspection.
#
# Run from the repo root:
#   bash scripts/test_pdf_font_sizes.sh          # use existing bundle
#   bash scripts/test_pdf_font_sizes.sh --build  # rebuild frontend first
#
# Requirements:
#   - Docker Compose stack running (superset-superset-1 container up)
#   - DASHBOARD_REPORTS_BROWSER_PRINT_PDF=True and
#     PLAYWRIGHT_REPORTS_AND_THUMBNAILS=True in
#     docker/pythonpath_dev/superset_config_docker.py

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

    import json as _json

    user = db.session.query(User).filter_by(username='admin').first()
    window_size: WindowSize = (1600, 1200)

    def get_url(dash):
        if dash.slug:
            return f"http://superset:8088/superset/dashboard/{dash.slug}/"
        return f"http://superset:8088/superset/dashboard/{dash.id}/"

    def get_tab_ids(dash):
        """Return ordered list of TAB-xxx IDs from the dashboard layout, or []."""
        layout = dash.position_json
        if isinstance(layout, str):
            layout = _json.loads(layout)
        tab_ids = []
        for item in layout.values():
            if not isinstance(item, dict): continue
            if item.get('type') == 'TABS':
                for child_id in item.get('children', []):
                    child = layout.get(child_id, {})
                    if isinstance(child, dict) and child.get('type') == 'TAB':
                        tab_ids.append(child_id)
                if tab_ids:
                    break  # only process the first TABS component
        return tab_ids

    def gen_pdf(label, base_url, digest, font_size=None, print_layout=None,
                print_orientation=None, tab_ids=None):
        t0 = time.monotonic()
        shot = DashboardPrintScreenshot(
            base_url, digest, window_size=window_size,
            font_size=font_size, print_layout=print_layout,
            print_orientation=print_orientation,
        )
        print(f"[{label}] URL: {shot.url} tab_ids={tab_ids}", flush=True)
        pdf = shot.get_print_pdf(
            user=user, log_context=f"test-{label}",
            header_title=label, font_size=font_size,
            print_layout=print_layout, print_orientation=print_orientation,
            tab_ids=tab_ids,
        )
        elapsed = time.monotonic() - t0
        out = f"/tmp/test_pdf_{label}.pdf"
        if pdf:
            with open(out, "wb") as f: f.write(pdf)
            print(f"[{label}] SUCCESS: {len(pdf):,} bytes in {elapsed:.1f}s -> {out}", flush=True)
        else:
            print(f"[{label}] FAILED in {elapsed:.1f}s", flush=True)
            sys.exit(1)

    # ── Dashboard 10: Large Table PDF Test ───────────────────────────────────
    d10 = db.session.query(Dashboard).filter_by(id=10).one()
    u10 = get_url(d10)
    t10 = get_tab_ids(d10)
    gen_pdf("dash10_small",  u10, d10.digest)
    gen_pdf("dash10_medium", u10, d10.digest, font_size="medium")
    gen_pdf("dash10_large",  u10, d10.digest, font_size="large")
    gen_pdf("dash10_2col",   u10, d10.digest, print_layout="2col",
            tab_ids=t10 or None)

    # custom header/footer demo for dashboard 10
    from superset.utils.webdriver import WebDriverPlaywright
    flask_app.config["BROWSER_PRINT_PDF_HEADER_CONTENT"] = {
        "left":   "{title}",
        "center": "ACME Corp — Internal Use Only",
        "right":  "Printed: {date}",
    }
    flask_app.config["BROWSER_PRINT_PDF_FOOTER_CONTENT"] = {
        "left":   "CONFIDENTIAL · Do not distribute",
        "center": "analytics.acme.com",
    }
    gen_pdf("dash10_custom", u10, d10.digest)
    # Reset to defaults
    flask_app.config.pop("BROWSER_PRINT_PDF_HEADER_CONTENT", None)
    flask_app.config.pop("BROWSER_PRINT_PDF_FOOTER_CONTENT", None)

    # ── Dashboard 2: World Bank's Data ───────────────────────────────────────
    d2 = db.session.query(Dashboard).filter_by(id=2).one()
    u2 = get_url(d2)
    t2 = get_tab_ids(d2)
    gen_pdf("dash2_small", u2, d2.digest)
    gen_pdf("dash2_2col",  u2, d2.digest, print_layout="2col",
            tab_ids=t2 or None)

    # ── Dashboard 5: Video Game Sales — EC1 (client-side pagination) ─────────
    # The "Games" table has page_length=15 (client-side pagination).
    # SHOW_ALL_TABLE_ROWS_JS must fire onChange(0) to expand it to all rows.
    # Verify: the PDF should show ALL video game rows, not just the first 15.
    d5 = db.session.query(Dashboard).filter_by(id=5).one()
    u5 = get_url(d5)
    t5 = get_tab_ids(d5)
    gen_pdf("dash5_paginated", u5, d5.digest, tab_ids=t5 or None)

    # ── Dashboard 6: Sales Dashboard — EC6 (multi-tab) ───────────────────────
    d6 = db.session.query(Dashboard).filter_by(id=6).one()
    u6 = get_url(d6)
    t6 = get_tab_ids(d6)
    gen_pdf("dash6_small", u6, d6.digest, tab_ids=t6 or None)
    gen_pdf("dash6_2col",  u6, d6.digest, print_layout="2col",
            tab_ids=t6 or None)

    # ── Dashboard 8: Misc Charts — EC7 (mixed chart types) ───────────────────
    d8 = db.session.query(Dashboard).filter_by(id=8).one()
    u8 = get_url(d8)
    t8 = get_tab_ids(d8)
    gen_pdf("dash8_small", u8, d8.digest)
    gen_pdf("dash8_2col",  u8, d8.digest, print_layout="2col",
            tab_ids=t8 or None)

    # ── Dashboard 11: Wide Table PDF Test — EC10 (wide columns) ─────────────
    # Create or reuse dashboard 11 with the flights table (44 columns).
    # SCALE_WIDE_TABLES_JS must detect tableScrollWidth > viewport and apply
    # transform:scale() to fit all columns on the A4 page without clipping.
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.slice import Slice
    import uuid, json

    def _get_or_create_wide_table_dashboard():
        """
        Find or build a dashboard containing a table chart from the flights
        dataset (44 columns) — enough to demonstrate SCALE_WIDE_TABLES_JS.
        Falls back gracefully to any wide table that is available.
        Returns the Dashboard object.
        """
        existing = db.session.query(Dashboard).filter_by(
            dashboard_title="Wide Table PDF Test").first()
        if existing:
            print(f"  [wide] reusing existing dashboard id={existing.id}", flush=True)
            return existing

        # Use flights (44 columns) as the primary wide-table test case.
        # wb_health_population (328 cols) is too slow for a live test run.
        flights_ds = db.session.query(SqlaTable).filter_by(
            table_name="flights").first()

        if flights_ds is not None:
            datasource = flights_ds
        else:
            # Fall back to the widest available dataset
            all_ds = db.session.query(SqlaTable).all()
            if not all_ds:
                raise RuntimeError("No SqlaTable datasets found — load sample data first")
            datasource = max(all_ds, key=lambda t: len(t.columns))
            print(f"  [wide] no flights dataset; using '{datasource.table_name}' "
                  f"({len(datasource.columns)} cols)", flush=True)

        col_count = len(datasource.columns)
        # all_columns: list of column names for the table viz.  The table
        # plugin uses 'all_columns' (not 'columns') to specify which columns
        # to display.  We pass all column names so the table is maximally
        # wide and triggers SCALE_WIDE_TABLES_JS.
        all_columns = [c.column_name for c in datasource.columns]
        # Row limit is small (20 rows) — the test is about column overflow,
        # not row count.  page_length=0 = no client-side pagination.
        params = json.dumps({
            "viz_type": "table",
            "datasource": f"{datasource.id}__table",
            "row_limit": 20,
            "page_length": 0,
            "include_time": False,
            "metrics": [],
            "groupby": [],
            "all_columns": all_columns,
            "order_by_cols": [],
            "adhoc_filters": [],
            "table_timestamp_format": "smart_date",
            "show_cell_bars": False,
            "color_pn": False,
            "url_params": {},
        })
        slc = Slice(
            slice_name=f"{datasource.table_name} ({col_count} columns — wide table test)",
            viz_type="table",
            datasource_id=datasource.id,
            datasource_type="table",
            params=params,
        )
        db.session.add(slc)
        db.session.flush()
        slices = [slc]
        print(f"  [wide] created chart '{slc.slice_name}' id={slc.id}", flush=True)

        # Build a single-column layout using the v2 schema that Superset's
        # dashboard renderer expects.  CHART nodes live directly inside ROW
        # nodes (no COLUMN wrapper).  ROOT_ID and GRID_ID are literal keys.
        row_id   = "ROW-"  + uuid.uuid4().hex[:8]
        chart_id = "CHART-" + uuid.uuid4().hex[:8]
        slc = slices[0]  # only one chart

        layout = {
            "DASHBOARD_VERSION_KEY": "v2",
            "ROOT_ID": {
                "type": "ROOT", "id": "ROOT_ID",
                "children": ["GRID_ID"],
            },
            "GRID_ID": {
                "type": "GRID", "id": "GRID_ID",
                "children": [row_id],
                "parents": ["ROOT_ID"],
            },
            row_id: {
                "type": "ROW", "id": row_id,
                "children": [chart_id],
                "parents": ["ROOT_ID", "GRID_ID"],
                "meta": {"background": "BACKGROUND_TRANSPARENT"},
            },
            chart_id: {
                "type": "CHART", "id": chart_id,
                "children": [],
                "parents": ["ROOT_ID", "GRID_ID", row_id],
                "meta": {
                    "chartId": slc.id,
                    "width": 12,
                    "height": 50,
                    "sliceName": slc.slice_name,
                },
            },
        }

        dash = Dashboard(
            dashboard_title="Wide Table PDF Test",
            position_json=json.dumps(layout),
            published=True,
        )
        dash.slices = slices
        db.session.add(dash)
        db.session.commit()
        print(f"  [wide] created dashboard id={dash.id}", flush=True)
        return dash

    d11 = _get_or_create_wide_table_dashboard()
    u11 = get_url(d11)
    t11 = get_tab_ids(d11)
    # EC10a: portrait (default) — SCALE_WIDE_TABLES_JS shrinks table to fit
    gen_pdf("dash11_wide_portrait", u11, d11.digest, tab_ids=t11 or None)
    # EC10b: landscape — full-document landscape, all 44 columns readable
    gen_pdf("dash11_wide_landscape", u11, d11.digest,
            print_orientation="landscape", tab_ids=t11 or None)
    # EC10c: auto — portrait for normal charts, landscape page just for wide table
    gen_pdf("dash11_wide_auto", u11, d11.digest,
            print_orientation="auto", tab_ids=t11 or None)
    # EC10d: large font + landscape — verify no title clipping
    gen_pdf("dash11_wide_large", u11, d11.digest, font_size="large",
            print_orientation="landscape", tab_ids=t11 or None)

print("All 16 PDFs generated.", flush=True)
PYEOF

# ── copy script into container and run it ────────────────────────────────────
echo ">>> Generating PDFs inside $CONTAINER ..."
docker cp /tmp/_sip212_test.py "$CONTAINER:/tmp/_sip212_test.py"

PYTHON_OUTPUT=$(docker exec "$CONTAINER" python3 /tmp/_sip212_test.py 2>&1) || {
  echo ""
  echo "!!! Python script failed. Full output:"
  echo "$PYTHON_OUTPUT"
  exit 1
}

echo "$PYTHON_OUTPUT" | grep -E "^\[|^\s+\[|^All" || true
echo "$PYTHON_OUTPUT" | grep "ERROR:superset" || true

# ── copy PDFs to Desktop ──────────────────────────────────────────────────────
echo ">>> Copying PDFs to $DESKTOP ..."
PDFS=(
  dash10_small dash10_medium dash10_large dash10_2col dash10_custom
  dash2_small dash2_2col
  dash5_paginated
  dash6_small dash6_2col
  dash8_small dash8_2col
  dash11_wide_portrait dash11_wide_landscape dash11_wide_auto dash11_wide_large
)
for NAME in "${PDFS[@]}"; do
  docker cp "$CONTAINER:/tmp/test_pdf_${NAME}.pdf" \
    "$DESKTOP/test_pdf_${NAME}.pdf"
  echo "    Copied test_pdf_${NAME}.pdf"
done

# ── open all PDFs ─────────────────────────────────────────────────────────────
echo ">>> Opening PDFs..."
for NAME in "${PDFS[@]}"; do
  open "$DESKTOP/test_pdf_${NAME}.pdf"
done

echo ""
echo "Done. 16 PDFs open on your Desktop:"
echo ""
echo "  Dashboard 10 — Large Table PDF Test"
echo "    test_pdf_dash10_small.pdf    — EC3: 1000-row table, page_length=0 (all rows)"
echo "    test_pdf_dash10_medium.pdf   — medium font tier"
echo "    test_pdf_dash10_large.pdf    — large font tier (title clipping FIXED)"
echo "    test_pdf_dash10_2col.pdf     — EC9: wide table + 2-column adaptive layout"
echo "    test_pdf_dash10_custom.pdf   — custom ACME Corp header/footer"
echo ""
echo "  Dashboard 2 — World Bank's Data"
echo "    test_pdf_dash2_small.pdf     — EC5: sticky-header table + sibling canvas charts"
echo "    test_pdf_dash2_2col.pdf      — 2-column adaptive layout"
echo ""
echo "  Dashboard 5 — Video Game Sales"
echo "    test_pdf_dash5_paginated.pdf — EC1: Games table page_length=15 → all rows shown"
echo ""
echo "  Dashboard 6 — Sales Dashboard"
echo "    test_pdf_dash6_small.pdf     — EC6: multi-tab PDF merge (2 tabs)"
echo "    test_pdf_dash6_2col.pdf      — EC6 + 2-column adaptive layout"
echo ""
echo "  Dashboard 8 — Misc Charts"
echo "    test_pdf_dash8_small.pdf     — EC7: mixed chart types"
echo "    test_pdf_dash8_2col.pdf      — EC7 + 2-column adaptive layout"
echo ""
echo "  Dashboard 11 — Wide Table PDF Test  [NEW]"
echo "    test_pdf_dash11_wide_portrait.pdf — EC10a: 44 cols, portrait, CSS scale shrink-to-fit"
echo "    test_pdf_dash11_wide_landscape.pdf— EC10b: 44 cols, full-document landscape"
echo "    test_pdf_dash11_wide_auto.pdf    — EC10c: 44 cols, auto mixed-orientation"
echo "    test_pdf_dash11_wide_large.pdf   — EC10d: landscape + large font, no title clipping"
echo ""
echo "  What to verify:"
echo "    dash5_paginated     : Games table shows ALL rows (not just 15)"
echo "    dash10_*            : 1000-row table fully visible, no overflow"
echo "    dash10_large        : chart titles fully visible — no bottom clipping"
echo "    dash2_*             : % Rural map visible, table rows not interleaved"
echo "    dash6_small/2col    : Both sales tabs present in merged PDF"
echo "    dash11_wide_portrait: all 44 cols visible, shrunk to fit portrait width"
echo "    dash11_wide_landscape: all 44 cols readable at full landscape width"
echo "    dash11_wide_auto    : wide table on landscape page, other content portrait"
echo "    dash11_wide_large   : titles NOT clipped (overflow:visible fix applied)"

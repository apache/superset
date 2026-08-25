"""
Diagnostic: inspect inline vs computed heights before/after EXPAND_TABLE_CONTAINERS_JS
for every .grid-row that contains a table chart in the world_health dashboard.
Run inside Docker: python3 scripts/diag_table_layout.py
"""
from playwright.sync_api import sync_playwright

DASH_URL = "http://superset:8088/superset/dashboard/world_health/?standalone=3&print=1"

EXPAND_JS = """() => {
    function releaseEl(el) {
        if (!el || !el.style) return;
        if (el.style.height && el.style.height !== 'auto') {
            el.style.height = 'auto'; el.style.maxHeight = 'none';
        }
        ['overflow','overflowY','overflowX'].forEach(function(p) {
            if (['hidden','auto','scroll'].indexOf(el.style[p]) !== -1)
                el.style[p] = 'visible';
        });
    }
    var sel = '.superset-chart-table, [data-test-viz-type="table"]';
    var roots = document.querySelectorAll(sel);
    for (var ri = 0; ri < roots.length; ri++) {
        var root = roots[ri];
        var inner = root.querySelectorAll('div[style]');
        for (var ii = 0; ii < inner.length; ii++) {
            var s = inner[ii].style;
            if (s.height && s.height !== 'auto' && (s.overflow === 'auto' || s.overflow === 'scroll' || inner[ii].scrollHeight > inner[ii].clientHeight + 10)) {
                s.height = 'auto'; s.maxHeight = 'none'; s.overflow = 'visible'; s.overflowY = 'visible';
            }
        }
        var gridRow = null;
        var el = root.parentElement;
        while (el) {
            if (el.classList.contains('dashboard-grid') || el.classList.contains('grid-content')) break;
            if (el.classList.contains('grid-row')) gridRow = el;
            releaseEl(el);
            el = el.parentElement;
        }
        if (gridRow) {
            var sibCols = gridRow.querySelectorAll(':scope > .dragdroppable-column');
            for (var ci = 0; ci < sibCols.length; ci++) {
                releaseEl(sibCols[ci]);
                var rc = sibCols[ci].querySelector(':scope > .resizable-container');
                if (rc) releaseEl(rc);
            }
        }
    }
    return roots.length;
}"""

DIAG_JS = """() => {
    var rows = [];
    var gridRows = document.querySelectorAll('.grid-row');
    for (var gi = 0; gi < gridRows.length; gi++) {
        var gr = gridRows[gi];
        var cols = Array.from(gr.querySelectorAll(':scope > .dragdroppable-column'));
        var hasT = cols.some(function(c) { return c.querySelector('.superset-chart-table'); });
        if (!hasT) continue;
        var ddr = gr.closest('.dragdroppable-row');
        var wpm = gr.closest('.with-popover-menu');
        rows.push({
            gr_h: gr.style.height || 'none',
            gr_ch: getComputedStyle(gr).height,
            ddr_h: ddr ? (ddr.style.height || 'none') : 'NA',
            ddr_ch: ddr ? getComputedStyle(ddr).height : 'NA',
            wpm_h: wpm ? (wpm.style.height || 'none') : 'NA',
            wpm_ch: wpm ? getComputedStyle(wpm).height : 'NA',
            cols: cols.map(function(c) {
                var rc = c.querySelector(':scope > .resizable-container');
                var tbl = c.querySelector('.superset-chart-table');
                var holder = c.querySelector('.dashboard-component-chart-holder');
                return {
                    hasT: !!tbl,
                    c_h: c.style.height || 'none',
                    c_ch: getComputedStyle(c).height,
                    rc_h: rc ? (rc.style.height || 'none') : 'NA',
                    rc_ch: rc ? getComputedStyle(rc).height : 'NA',
                    holder_h: holder ? (holder.style.height || 'none') : 'NA',
                    holder_ch: holder ? getComputedStyle(holder).height : 'NA',
                    tbl_sh: tbl ? tbl.scrollHeight : 0,
                    tbl_ch: tbl ? tbl.clientHeight : 0,
                };
            })
        });
    }
    return rows;
}"""

READY_JS = """() => {
    var h = document.querySelectorAll('.dashboard-component-chart-holder[class*="dashboard-chart-id-"]');
    if (h.length === 0) return false;
    for (var i = 0; i < h.length; i++) {
        if (!h[i].querySelector('.slice_container') && !h[i].querySelector('[role="alert"]') && !h[i].querySelector('.ant-empty'))
            return false;
    }
    return true;
}"""

def fmt_rows(rows, label):
    print(f"\n=== {label} ===")
    for i, r in enumerate(rows):
        print(f"GridRow{i}: gr_h={r['gr_h']} gr_ch={r['gr_ch']} | ddr_h={r['ddr_h']} ddr_ch={r['ddr_ch']} | wpm_h={r['wpm_h']} wpm_ch={r['wpm_ch']}")
        for j, c in enumerate(r['cols']):
            print(f"  col[{j}] hasT={c['hasT']} c_h={c['c_h']} c_ch={c['c_ch']} rc_h={c['rc_h']} rc_ch={c['rc_ch']} holder_h={c['holder_h']} holder_ch={c['holder_ch']} tbl_sh={c['tbl_sh']} tbl_ch={c['tbl_ch']}")

with sync_playwright() as pw:
    br = pw.chromium.launch(args=["--no-sandbox"])
    # Use a tall viewport so more charts mount
    pg = br.new_context(viewport={"width": 1600, "height": 10000}).new_page()

    pg.goto("http://superset:8088/login/")
    pg.fill("#username", "admin")
    pg.fill("#password", "general")
    pg.click("[type=submit]")
    pg.wait_for_load_state("networkidle")

    pg.goto(DASH_URL, wait_until="domcontentloaded")
    # Wait generously for chart holders to mount
    pg.wait_for_timeout(10000)

    # Print how many holders exist and how many are ready
    holder_info = pg.evaluate("""() => {
        var h = document.querySelectorAll('.dashboard-component-chart-holder[class*="dashboard-chart-id-"]');
        var ready = 0;
        for (var i=0;i<h.length;i++) {
            if (h[i].querySelector('.slice_container') || h[i].querySelector('[role="alert"]') || h[i].querySelector('.ant-empty'))
                ready++;
        }
        return {total: h.length, ready: ready};
    }""")
    print(f"Chart holders: total={holder_info['total']} ready={holder_info['ready']}")

    # Also count table elements
    tbl_count = pg.evaluate("() => document.querySelectorAll('.superset-chart-table').length")
    print(f"Table elements found: {tbl_count}")

    before = pg.evaluate(DIAG_JS)
    fmt_rows(before, "BEFORE expand JS")

    pg.evaluate(EXPAND_JS)
    pg.wait_for_timeout(300)

    after = pg.evaluate(DIAG_JS)
    fmt_rows(after, "AFTER expand JS")

    br.close()

import sys
sys.path.insert(0, '/app/docker/pythonpath_dev')

from superset import create_app
app = create_app()

with app.app_context():
    from flask import g
    from superset.extensions import security_manager
    from superset.utils.screenshots import DashboardPrintScreenshot
    from superset.commands.report.execute import resolve_executor_user
    from superset.daos.report import ReportScheduleDAO
    from flask import current_app as fapp

    # Set a logged-in user on g so security filters don't fail
    admin = security_manager.find_user("admin")
    g.user = admin

    schedule = ReportScheduleDAO.find_by_id(1, skip_base_filter=True)
    user, _ = resolve_executor_user(schedule)

    w, h = fapp.config["WEBDRIVER_WINDOW"]["dashboard"]
    shot = DashboardPrintScreenshot(
        f"http://superset:8088/dashboard/{schedule.dashboard.uuid}/",
        schedule.dashboard.digest,
        window_size=(w, h),
    )
    pdf = shot.get_print_pdf(user=user, log_context="manual_test")
    if pdf:
        with open("/app/superset_home/test_output.pdf", "wb") as f:
            f.write(pdf)
        print(f"Written {len(pdf)} bytes to /app/superset_home/test_output.pdf")
    else:
        print("get_print_pdf returned None")

from superset import db

class SuspendSession:
    def __enter__(self):
        self.session_objects = db.session.identity_map.values()
        db.session.close()
    def __exit__(self, exc_type, exc_val, exc_tb):
        for obj in self.session_objects:
            db.session.add(obj)
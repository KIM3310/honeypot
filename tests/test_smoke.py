import unittest


class TestSmoke(unittest.TestCase):
    def test_import_app(self):
        # Import should not require real cloud credentials.
        from app.main import app  # noqa: F401

    def test_health_route_exists(self):
        from app.main import app

        paths = {route.path for route in app.routes}
        self.assertIn("/api/health", paths)


if __name__ == "__main__":
    unittest.main()

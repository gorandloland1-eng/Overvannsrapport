import sys
import unittest
from pathlib import Path
from unittest.mock import patch

import requests
from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.routers import ivf


class IvfTimeoutTest(unittest.TestCase):
    def setUp(self):
        ivf._source_metadata_cache.clear()
        app = FastAPI()
        app.include_router(ivf.router, prefix="/ivf")
        self.client = TestClient(app)

    def test_station_metadata_read_timeout_returns_safe_504(self):
        with patch.object(
            ivf.SESSION,
            "get",
            side_effect=requests.exceptions.ReadTimeout("simulated timeout"),
        ):
            response = self.client.get("/ivf/SN19710")

        self.assertEqual(response.status_code, 504)
        payload = response.json()
        self.assertEqual(
            payload,
            {"detail": "Værdatatjenesten brukte for lang tid på å svare. Prøv igjen."},
        )
        self.assertNotIn("ReadTimeout", response.text)
        self.assertNotIn("Traceback", response.text)
        self.assertNotIn("HTTPSConnectionPool", response.text)


if __name__ == "__main__":
    unittest.main()

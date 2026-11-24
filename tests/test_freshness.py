import json
from pathlib import Path
import sys, tempfile, unittest
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"scripts"))
import build

class FreshnessTests(unittest.TestCase):
    def test_failed_refresh_retains_rolling_capture_date_and_ignores_historical_case(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp); (root/"data").mkdir(); (root/"site").mkdir()
            cases=[{"id":"fixed"},{"id":"rolling","days":7}]
            snapshots={"fixed":{"capturedAt":"2020-01-01T00:00:00Z"},"rolling":{"capturedAt":"2026-11-20T00:00:00Z"}}
            (root/"data/cases.json").write_text(json.dumps(cases))
            (root/"data/snapshot.json").write_text(json.dumps(snapshots))
            with patch.object(build,"ROOT",root),patch.object(sys,"argv",["build.py"]),patch.object(build,"refresh",side_effect=OSError("unavailable")):
                build.main()
            status=json.loads((root/"dist/data-status.json").read_text())
            self.assertEqual(status["oldest_retrieval"],snapshots["rolling"]["capturedAt"])
            self.assertEqual(set(status["rolling_cases"]),{"rolling"})

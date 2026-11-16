#!/usr/bin/env python3
"""Prepare a static snapshot from OONI Web Connectivity daily aggregates."""
import argparse
import json
import shutil
import time
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from urllib.error import URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
API = "https://api.ooni.io/api/v1/"
OUTCOMES = ("ok", "anomaly", "confirmed", "failure")


def query(endpoint, params):
    request = Request(API + endpoint + "?" + urlencode(params), headers={
        "Accept": "application/json",
        "User-Agent": "CoolCode.ca Blocked or Gone research snapshots (+https://coolcode.ca/blockedorgone/)",
    })
    with urlopen(request, timeout=22) as response:
        body = json.load(response)
    return body["results" if endpoint == "measurements" else "result"]


def window(case, today):
    if "days" in case:
        # Complete UTC days only.
        return (today - timedelta(days=case["days"])).isoformat(), today.isoformat()
    return case["since"], case["until"]


def aggregate_rows(raw_rows, since, until):
    rows = []
    for raw in raw_rows:
        day = raw["measurement_start_day"][:10]
        if not since <= day < until:
            continue
        counts = {outcome: int(raw[outcome + "_count"]) for outcome in OUTCOMES}
        total = int(raw["measurement_count"])
        if any(count < 0 for count in counts.values()) or sum(counts.values()) != total:
            raise ValueError(f"Unexpected outcome counts for {day}")
        if total:
            rows.append({"date": day, **counts})
    return sorted(rows, key=lambda row: row["date"])


def refresh(case, today, captured_at):
    since, until = window(case, today)
    filters = {
        "domain": case["domain"], "probe_cc": case["code"],
        "test_name": "web_connectivity", "since": since, "until": until,
    }
    rows = aggregate_rows(query("aggregation", {
        **filters, "axis_x": "measurement_start_day", "time_grain": "day",
    }), since, until)
    examples = []
    if case.get("sampleMeasurements") and rows:
        try:
            for record in query("measurements", {**filters, "limit": 3}):
                outcome = next((name for name in ("confirmed", "anomaly", "failure") if record.get(name)), "ok")
                examples.append({
                    "uid": record["measurement_uid"], "time": record["measurement_start_time"],
                    "asn": record.get("probe_asn") or "Network not listed", "outcome": outcome,
                })
        except (OSError, URLError, KeyError, ValueError, TypeError) as error:
            print(f"{case['id']}: optional example lookup failed ({error})", flush=True)
    return {"since": since, "until": until, "capturedAt": captured_at, "rows": rows, "examples": examples}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--refresh-seed", action="store_true", help="Refresh and save the checked-in seed")
    mode.add_argument("--offline", action="store_true", help="Build from the checked-in seed without the API")
    args = parser.parse_args()
    cases = json.loads((ROOT / "data/cases.json").read_text(encoding="utf8"))
    seed_path = ROOT / "data/snapshot.json"
    snapshots = json.loads(seed_path.read_text(encoding="utf8")) if seed_path.exists() else {}
    now = datetime.now(timezone.utc)
    captured_at = now.isoformat(timespec="seconds")
    output = []
    refreshed = 0
    for case in cases:
        case_id = case["id"]
        snapshot = snapshots.get(case_id)
        if not args.offline and (args.refresh_seed or not snapshot or "days" in case):
            if refreshed:
                time.sleep(1)
            refreshed += 1
            try:
                updated = refresh(case, now.date(), captured_at)
            except (OSError, URLError, KeyError, ValueError, TypeError) as error:
                print(f"{case_id}: source refresh failed ({error})", flush=True)
            else:
                snapshot = updated
                snapshots[case_id] = updated
                print(f"{case_id}: {len(updated['rows'])} dates with measurements", flush=True)
        if snapshot:
            output.append({**case, **snapshot})
        else:
            since, until = window(case, now.date())
            output.append({**case, "since": since, "until": until, "rows": [], "unavailable": True})
    if not snapshots:
        raise SystemExit("OONI refresh failed for every case and no seed is available")
    if args.refresh_seed:
        seed_path.write_text(json.dumps(snapshots, separators=(",", ":"), ensure_ascii=False) + "\n", encoding="utf8")
    dist = ROOT / "dist"
    if dist.exists():
        shutil.rmtree(dist)
    shutil.copytree(ROOT / "site", dist)
    (dist / "snapshots.json").write_text(json.dumps(output, separators=(",", ":"), ensure_ascii=False) + "\n", encoding="utf8")
    print(f"Built {dist}")


if __name__ == "__main__":
    main()

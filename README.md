# Blocked or Gone?

<!-- coolcode:guide -->
Open a case and compare its daily measurement outcomes, then follow the evidence into OONI Explorer. Use the lookup form for another domain and country; an anomalous measurement alone does not establish intentional blocking.
<!-- /coolcode:guide -->

A CoolCode.ca research tool for exploring internet interference measurements. The case library compares daily Web Connectivity outcomes for Discord in Türkiye, Russia and Canada and the Zawya cinema site in Egypt. Each chart links to its period, daily evidence and any linked examples in OONI Explorer. The lookup form opens a source search for any domain and an optional country or UTC date range.

## Develop and deploy

```sh
python3 scripts/build.py
python3 -m http.server 8080 --directory dist
```

Open `http://localhost:8080/`. The build uses Python 3's standard library and outputs a static site under `dist/`. Asset paths are relative for the CoolCode.ca project path. No API key is required.

By default builds re-fetch the rolling Canadian case. The historical cases use a checked-in source snapshot, which is also the fallback if a rolling refresh fails. The UI shows the retrieval date. The rolling window ends with the latest complete UTC day. Run `python3 scripts/build.py --offline` for a reproducible local build using the seed. To revise the historical cases or update the checked-in fallback, edit `data/cases.json` as needed and run `python3 scripts/build.py --refresh-seed`. Review `data/snapshot.json` before committing the update.

## Data and interpretation

- Source: [OONI API](https://api.ooni.io/), JSON v1 aggregation and measurement metadata endpoints. See [OONI data access](https://docs.ooni.org/data/) and the [Web Connectivity methodology](https://ooni.org/nettest/web-connectivity/).
- This build selects daily counts for the configured domains, countries and time windows. It keeps OONI’s mutually exclusive aggregate labels and includes sparse dates as gaps in the UI. Example links retain source measurement IDs and a small amount of descriptive metadata. The API is intended for lightweight queries. Arbitrary searches run on OONI Explorer.
- Testing coverage is uneven. An anomalous measurement can reflect interference or a network or server issue. Confirmed measurements matched OONI’s documented fingerprints. Even a series of measurements establishes observations for the tested networks and time window only.
- Data copyright © 2020 Open Observatory of Network Interference (OONI), under the [OONI data license](https://github.com/ooni/license/blob/master/data/LICENSE.md). The adapted files `data/snapshot.json` and `dist/snapshots.json` are shared under [Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International](https://creativecommons.org/licenses/by-nc-sa/4.0/).

<!-- schedule-reliability -->
## Schedule reliability

Public GitHub repositories can have scheduled workflows disabled after 60 days of inactivity. A separate weekly [schedule guard](.github/workflows/schedule-guard.yml) calls GitHub's enable-workflow API for an explicit list of refresh workflows and itself. It can restore workflows disabled for inactivity, preserves manually disabled workflows, and runs independently of collection failures.

This is an interim mitigation, not a scheduling guarantee: GitHub does not document active-workflow renewal as a permanent exemption, and scheduled runs can be delayed or dropped. A scheduler on our own Linux server is the planned independent trigger. The guard does not collect data, create dummy commits, or change source/check timestamps; successful collection and published data freshness still need monitoring.
<!-- /schedule-reliability -->

## Published freshness

`data-status.json` exposes the oldest `capturedAt` among configured rolling cases. A failed refresh or offline build keeps the retained source date; a missing capture yields `null`. Fixed historical examples are excluded from the daily freshness check.

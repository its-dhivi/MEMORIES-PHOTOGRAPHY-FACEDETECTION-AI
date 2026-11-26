"""Evaluate event-gallery search results from a manually labeled, consented dataset.

Input is JSONL (one candidate photo per query): event_id, split, query_id,
query_person_id, photo_id, person_ids (manually verified identities in that
photo), score (number or null), and optional capture_tags. Identity labels are
never inferred from model predictions. Keep input and output in a restricted,
encrypted evaluation directory.
"""

from __future__ import annotations

import argparse
import json
import math
from collections import defaultdict
from pathlib import Path
from typing import Any


def wilson(successes: int, trials: int, z: float = 1.96) -> list[float] | None:
    if trials <= 0:
        return None
    rate = successes / trials
    denominator = 1 + z * z / trials
    center = (rate + z * z / (2 * trials)) / denominator
    margin = z * math.sqrt(rate * (1 - rate) / trials + z * z / (4 * trials**2)) / denominator
    return [max(0.0, center - margin), min(1.0, center + margin)]


def evaluate(rows: list[dict[str, Any]], threshold: float) -> dict[str, Any]:
    queries: dict[tuple[str, str, str], list[dict[str, Any]]] = defaultdict(list)
    split_events: dict[str, set[str]] = defaultdict(set)
    for row in rows:
        required = {
            "event_id",
            "split",
            "query_id",
            "query_person_id",
            "photo_id",
            "person_ids",
            "score",
        }
        missing = required - row.keys()
        if missing:
            raise ValueError(f"Row missing fields: {', '.join(sorted(missing))}")
        if row["split"] not in {"calibration", "evaluation"}:
            raise ValueError("split must be calibration or evaluation")
        if not isinstance(row["person_ids"], list):
            raise ValueError("person_ids must contain manual identity labels as a JSON array")
        event = str(row["event_id"])
        split_events[str(row["split"])].add(event)
        queries[(str(row["split"]), event, str(row["query_id"]))].append(row)

    overlap = split_events["calibration"] & split_events["evaluation"]
    if overlap:
        raise ValueError("Calibration/evaluation events overlap; use independent events")
    identity_splits: dict[str, set[str]] = defaultdict(set)
    for row in rows:
        identity_splits[str(row["query_person_id"])].add(str(row["split"]))
    if any(len(splits) > 1 for splits in identity_splits.values()):
        raise ValueError("Calibration/evaluation query identities overlap")

    reports: dict[str, Any] = {}
    for split in ("calibration", "evaluation"):
        qrows = [(key, values) for key, values in queries.items() if key[0] == split]
        returned = relevant_returned = relevant_total = incorrect_photos = 0
        zero = false_accept_queries = false_reject_queries = 0
        capture: dict[str, dict[str, int]] = defaultdict(
            lambda: {"queries": 0, "false_accept_queries": 0}
        )
        per_query: list[dict[str, Any]] = []
        for (_, event_id, query_id), candidates in qrows:
            query_person = str(candidates[0]["query_person_id"])
            if any(
                str(candidate["event_id"]) != event_id
                or str(candidate["query_person_id"]) != query_person
                for candidate in candidates
            ):
                raise ValueError(f"Query {query_id} mixes events or ground-truth identities")
            relevant = {str(r["photo_id"]) for r in candidates if query_person in r["person_ids"]}
            if not relevant:
                raise ValueError(f"Query {query_id} has no manually labeled relevant gallery photo")
            selected = [
                r for r in candidates if r["score"] is not None and float(r["score"]) >= threshold
            ]
            selected_ids = {str(r["photo_id"]) for r in selected}
            hits = selected_ids & relevant
            false_ids = selected_ids - relevant
            false_accept = bool(false_ids)
            false_reject = not hits
            returned += len(selected_ids)
            relevant_returned += len(hits)
            relevant_total += len(relevant)
            incorrect_photos += len(false_ids)
            zero += not selected_ids
            false_accept_queries += false_accept
            false_reject_queries += false_reject
            tags = set().union(*(set(r.get("capture_tags", [])) for r in candidates))
            for tag in tags:
                capture[tag]["queries"] += 1
                capture[tag]["false_accept_queries"] += int(false_accept)
            per_query.append(
                {
                    "query_id": query_id,
                    "gallery_photos": len(candidates),
                    "relevant_photos": len(relevant),
                    "returned_photos": len(selected_ids),
                    "relevant_returned": len(hits),
                    "incorrect_photos_exposed": len(false_ids),
                    "false_accept": false_accept,
                    "false_reject": false_reject,
                    "zero_result": not selected_ids,
                }
            )
        query_count = len(qrows)
        reports[split] = {
            "events": len(split_events[split]),
            "queries": query_count,
            "candidate_photos": sum(len(items) for _, items in qrows),
            "photo_precision": relevant_returned / returned if returned else 0.0,
            "photo_precision_95pct_wilson_lower": (
                wilson(relevant_returned, returned)[0] if returned else None
            ),
            "photo_recall": relevant_returned / relevant_total if relevant_total else 0.0,
            "false_accept_rate_per_query": false_accept_queries / query_count
            if query_count
            else None,
            "false_accept_rate_95pct_wilson": wilson(false_accept_queries, query_count),
            "false_reject_rate_per_query": false_reject_queries / query_count
            if query_count
            else None,
            "zero_result_queries": zero,
            "incorrect_photos_exposed": incorrect_photos,
            "incorrect_photos_per_query": incorrect_photos / query_count if query_count else None,
            "capture_tag_false_accept_rates": {
                tag: {
                    "queries": values["queries"],
                    "false_accept_queries": values["false_accept_queries"],
                    "rate": values["false_accept_queries"] / values["queries"],
                }
                for tag, values in sorted(capture.items())
            },
            "per_query": per_query,
        }
    return {
        "protocol": "gallery-level threshold evaluation",
        "threshold": threshold,
        "independent_event_splits": True,
        "ground_truth_source": "manually assigned labels in input manifest",
        "reports": reports,
        "limitations": [
            "Wilson intervals are query-level and do not account for clustering by event "
            "or person.",
            "Only events and queries represented in the supplied manifest are measured.",
            "Choose the calibration threshold using calibration rows only, then freeze it "
            "before evaluation.",
        ],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "manifest",
        type=Path,
        help="Restricted JSONL file with manually verified gallery labels and scores",
    )
    parser.add_argument(
        "--threshold", type=float, required=True, help="Frozen threshold under evaluation"
    )
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    with args.manifest.open(encoding="utf-8") as stream:
        rows = [json.loads(line) for line in stream if line.strip()]
    report = evaluate(rows, args.threshold)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(
        json.dumps(
            {
                "threshold": args.threshold,
                "reports": {
                    key: {
                        name: value
                        for name, value in report["reports"][key].items()
                        if name != "per_query"
                    }
                    for key in report["reports"]
                },
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()

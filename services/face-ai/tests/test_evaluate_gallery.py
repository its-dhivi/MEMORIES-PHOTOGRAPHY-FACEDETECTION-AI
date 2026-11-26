from __future__ import annotations

import importlib.util
from pathlib import Path

import pytest

SCRIPT = Path(__file__).parents[1] / "scripts" / "evaluate_gallery.py"
spec = importlib.util.spec_from_file_location("evaluate_gallery", SCRIPT)
assert spec and spec.loader
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def rows() -> list[dict[str, object]]:
    result = []
    for split, event in (("calibration", "event-a"), ("evaluation", "event-b")):
        result.extend(
            [
                {
                    "event_id": event,
                    "split": split,
                    "query_id": f"{split}-q",
                    "query_person_id": f"person-{split}",
                    "photo_id": "match",
                    "person_ids": [f"person-{split}"],
                    "score": 0.9,
                    "capture_tags": ["group"],
                },
                {
                    "event_id": event,
                    "split": split,
                    "query_id": f"{split}-q",
                    "query_person_id": f"person-{split}",
                    "photo_id": "false",
                    "person_ids": ["someone-else"],
                    "score": 0.7,
                },
                {
                    "event_id": event,
                    "split": split,
                    "query_id": f"{split}-q",
                    "query_person_id": f"person-{split}",
                    "photo_id": "rejected",
                    "person_ids": ["someone-else"],
                    "score": None,
                },
            ]
        )
    return result


def test_gallery_metrics_count_incorrect_exposure_and_missing_scores() -> None:
    report = module.evaluate(rows(), 0.8)
    evaluation = report["reports"]["evaluation"]
    assert evaluation["photo_precision"] == 1.0
    assert evaluation["photo_recall"] == 1.0
    assert evaluation["incorrect_photos_exposed"] == 0
    assert evaluation["zero_result_queries"] == 0
    assert evaluation["capture_tag_false_accept_rates"]["group"]["rate"] == 0.0


def test_rejects_event_overlap_between_calibration_and_evaluation() -> None:
    data = rows()
    data[-1]["event_id"] = "event-a"
    with pytest.raises(ValueError, match="events overlap"):
        module.evaluate(data, 0.8)


def test_rejects_queries_without_ground_truth_match() -> None:
    data = rows()
    data[0]["person_ids"] = ["another-person"]
    with pytest.raises(ValueError, match="no manually labeled relevant"):
        module.evaluate(data, 0.8)

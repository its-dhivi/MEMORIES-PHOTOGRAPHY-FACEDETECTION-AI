"""Propose a threshold from labeled local scores without changing live settings."""

import argparse
import json
from pathlib import Path


def measure(pairs: list[dict[str, object]], threshold: float) -> dict[str, object]:
    tp = fp = tn = fn = 0
    for pair in pairs:
        accepted = pair["score"] is not None and float(pair["score"]) >= threshold
        if pair["same"] and accepted:
            tp += 1
        elif pair["same"]:
            fn += 1
        elif accepted:
            fp += 1
        else:
            tn += 1
    return {
        "threshold": threshold,
        "true_positive": tp,
        "false_positive": fp,
        "true_negative": tn,
        "false_negative": fn,
        "precision": tp / (tp + fp) if tp + fp else 0,
        "recall": tp / (tp + fn) if tp + fn else 0,
        "false_acceptance_rate": fp / (fp + tn) if fp + tn else 0,
        "false_rejection_rate": fn / (tp + fn) if tp + fn else 0,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("pairs", type=Path)
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--preprocessing-version", required=True)
    parser.add_argument("--max-far", type=float, default=0.001)
    parser.add_argument("--min-precision", type=float, default=0.99)
    args = parser.parse_args()
    pairs = json.loads(args.pairs.read_text(encoding="utf-8"))
    report = json.loads(args.report.read_text(encoding="utf-8"))
    calibration = [pair for pair in pairs if pair["split"] == "calibration"]
    evaluation = [pair for pair in pairs if pair["split"] == "evaluation"]
    if not calibration or not evaluation:
        raise SystemExit("Both calibration and evaluation splits are required")
    curve = [measure(calibration, index / 1000) for index in range(0, 1001)]
    eligible = [
        item
        for item in curve
        if item["true_positive"] > 0
        and item["precision"] >= args.min_precision
        and item["false_acceptance_rate"] <= args.max_far
    ]
    proposed = (
        max(eligible, key=lambda item: (item["recall"], item["precision"])) if eligible else None
    )
    artifact = {
        "status": "PENDING_ADMIN_APPROVAL",
        "model_version": report["model_version"],
        "preprocessing_version": args.preprocessing_version,
        "source": report["source"],
        "calibration_pairs": len(calibration),
        "evaluation_pairs": len(evaluation),
        "max_far": args.max_far,
        "min_precision": args.min_precision,
        "current_threshold": report["threshold"],
        "proposed_threshold": proposed["threshold"] if proposed else None,
        "calibration_at_proposed": proposed,
        "evaluation_at_proposed": measure(evaluation, proposed["threshold"]) if proposed else None,
        "evaluation_at_current": measure(evaluation, report["threshold"]),
        "curve": curve,
        "warning": "No threshold is enabled by this utility; validate on real event data first.",
    }
    args.output.write_text(json.dumps(artifact, indent=2), encoding="utf-8")
    print(
        json.dumps(
            {
                key: artifact[key]
                for key in (
                    "status",
                    "proposed_threshold",
                    "calibration_at_proposed",
                    "evaluation_at_proposed",
                )
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()

"""Reconstruct benchmark sample, identity splits, image hashes and null-score pairs."""
import argparse
import hashlib
import json
import zipfile
from collections import Counter, defaultdict
from pathlib import Path

IMAGE_SUFFIXES = (".png", ".jpg", ".jpeg", ".webp")


def reconstruct(archive: zipfile.ZipFile, count: int):
    grouped = defaultdict(list)
    all_images = [n for n in archive.namelist() if n.lower().endswith(IMAGE_SUFFIXES)]
    for name in all_images:
        identity = next((part for part in name.split("/") if part.startswith("identity-")), None)
        if identity:
            grouped[identity].append(name)
    selected = sorted((i for i, names in grouped.items() if len(names) >= 3),
                      key=lambda i: hashlib.sha256(i.encode()).digest())[:count]
    manifest = []
    for idx, identity in enumerate(selected):
        split = "calibration" if idx % 2 == 0 else "evaluation"
        for image in sorted(grouped[identity])[:3]:
            manifest.append({"image": image, "identity": identity, "split": split})
    return all_images, grouped, manifest


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("archive", type=Path)
    ap.add_argument("pairs", type=Path)
    ap.add_argument("--output", type=Path, required=True)
    ap.add_argument("--identities", type=int, default=100)
    args = ap.parse_args()
    with zipfile.ZipFile(args.archive) as zf:
        all_images, grouped, manifest = reconstruct(zf, args.identities)
        hashes = defaultdict(list)
        errors = []
        for i, name in enumerate(all_images, 1):
            try:
                hashes[hashlib.sha256(zf.read(name)).hexdigest()].append(name)
            except Exception as exc:
                errors.append({"image": name, "error": f"{type(exc).__name__}: {exc}"})
            if i % 1000 == 0:
                print(f"Hashed {i}/{len(all_images)} benchmark images", flush=True)
    split_ids = {s: {r["identity"] for r in manifest if r["split"] == s} for s in ("calibration", "evaluation")}
    rows = json.loads(args.pairs.read_text(encoding="utf-8"))
    scored_null = [r for r in rows if r.get("score") is None]
    # evaluate.py pair_scores emits within each split, in manifest order, row-major (i,j).
    mapped_null = []
    cursor_by_split = Counter()
    for split in ("calibration", "evaluation"):
        subset = [r for r in manifest if r["split"] == split]
        pair_iter = ((a, b) for i, a in enumerate(subset) for b in subset[i+1:])
        pair_list = list(pair_iter)
        saved = [r for r in rows if r["split"] == split]
        for idx, saved_row in enumerate(saved):
            if idx >= len(pair_list):
                break
            if saved_row.get("score") is None:
                a, b = pair_list[idx]
                mapped_null.append({"split": split, "image_a": a["image"], "identity_a": a["identity"],
                                    "image_b": b["image"], "identity_b": b["identity"],
                                    "same_label": saved_row.get("same"),
                                    "cause_evidence": "embedding missing for at least one image; pair artifact has no per-image embedding status"})
        cursor_by_split[split] = len(saved)
    duplicate_groups = [names for names in hashes.values() if len(names) > 1]
    cross_identity = []
    for names in duplicate_groups:
        ids = {next((part for part in n.split("/") if part.startswith("identity-")), None) for n in names}
        if len(ids) > 1:
            cross_identity.append({"images": names, "identities": sorted(x for x in ids if x)})
    overlaps = split_ids["calibration"] & split_ids["evaluation"]
    selected_files = {r["image"] for r in manifest}
    result = {
        "archive": str(args.archive),
        "archive_image_count": len(all_images),
        "archive_identity_folder_count": len(grouped),
        "selected_manifest_images": len(manifest),
        "selected_identity_count": len({r["identity"] for r in manifest}),
        "selected_calibration_identities": len(split_ids["calibration"]),
        "selected_evaluation_identities": len(split_ids["evaluation"]),
        "split_identity_overlap_count": len(overlaps),
        "split_identity_overlap": sorted(overlaps),
        "manifest_matches_pair_file_expected_counts": {s: len([r for r in rows if r["split"] == s]) == (len([r for r in manifest if r["split"] == s]) * (len([r for r in manifest if r["split"] == s])-1)//2) for s in ("calibration", "evaluation")},
        "sha256_images_hashed": sum(len(v) for v in hashes.values()),
        "exact_duplicate_hash_group_count": len(duplicate_groups),
        "exact_duplicate_image_count_in_excess": sum(len(v)-1 for v in duplicate_groups),
        "cross_identity_exact_duplicate_groups": cross_identity,
        "corrupt_or_unreadable_archive_entries": errors,
        "null_score_pair_count": len(scored_null),
        "null_score_pairs_mapped": len(mapped_null),
        "null_score_label_counts": dict(Counter("same" if r.get("same_label") else "different" for r in mapped_null)),
        "null_score_causes": "The pair artifact records only null score, label, and split. Null means at least one image had no embedding in evaluate.py, but it does not preserve which image failed or detector/quality/failure reason. Pair ordering maps nulls to image pairs; root cause requires original per-image evaluator report/logs.",
        "null_score_pairs": mapped_null,
        "manifest": manifest,
        "unselected_image_count": len(set(all_images)-selected_files),
        "pair_rows": len(rows),
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps({k: result[k] for k in ("archive_image_count","archive_identity_folder_count","selected_manifest_images","selected_calibration_identities","selected_evaluation_identities","split_identity_overlap_count","sha256_images_hashed","exact_duplicate_hash_group_count","cross_identity_exact_duplicate_groups","null_score_pair_count","null_score_pairs_mapped","null_score_label_counts","manifest_matches_pair_file_expected_counts")},indent=2), flush=True)


if __name__ == "__main__":
    main()

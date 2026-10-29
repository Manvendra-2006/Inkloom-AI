import json
import os
import tempfile
from pathlib import Path

from fastapi import HTTPException

RULES_FILE = Path(__file__).with_name("brand_rules.json")


def load_brand_rules() -> dict:
    try:
        with RULES_FILE.open("r", encoding="utf-8") as file:
            data = json.load(file)
    except (OSError, json.JSONDecodeError) as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Could not load brand rules: {exc}",
        ) from exc

    if not isinstance(data, dict):
        raise HTTPException(
            status_code=500,
            detail="Brand rules must be a JSON object.",
        )

    if not isinstance(data.get("terms_requiring_review"), list):
        raise HTTPException(
            status_code=500,
            detail="terms_requiring_review must be a list.",
        )

    return data


def save_brand_rules(data: dict) -> dict:
    if not data.get("brand_name", "").strip():
        raise HTTPException(
            status_code=422,
            detail="Brand name cannot be blank.",
        )

    terms = data.get("terms_requiring_review")

    if not isinstance(terms, list):
        raise HTTPException(
            status_code=422,
            detail="terms_requiring_review must be a list.",
        )

    for rule in terms:
        if not isinstance(rule, dict):
            raise HTTPException(
                status_code=422,
                detail="Each rule must be an object.",
            )

        rule_terms = rule.get(
            "terms",
            [rule.get("term", "")],
        )

        if not isinstance(rule_terms, list):
            raise HTTPException(
                status_code=422,
                detail="Rule terms must be a list.",
            )

        if not any(
            isinstance(term, str) and term.strip()
            for term in rule_terms
        ):
            raise HTTPException(
                status_code=422,
                detail="Each rule needs at least one term.",
            )

        if not rule.get("guideline_id"):
            raise HTTPException(
                status_code=422,
                detail="Each rule needs a guideline_id.",
            )

        if not rule.get("category"):
            raise HTTPException(
                status_code=422,
                detail="Each rule needs a category.",
            )

        if str(rule.get("severity", "")).lower() not in {
            "low", "medium", "high", "critical"
        }:
            raise HTTPException(
                status_code=422,
                detail="Severity must be low, medium, high, or critical.",
            )

    RULES_FILE.parent.mkdir(parents=True, exist_ok=True)
    temp_path = None

    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            dir=RULES_FILE.parent,
            delete=False,
            suffix=".tmp",
        ) as file:
            json.dump(
                data,
                file,
                ensure_ascii=False,
                indent=2,
            )
            file.write("\n")
            temp_path = file.name

        os.replace(temp_path, RULES_FILE)

    except OSError as exc:
        if temp_path and os.path.exists(temp_path):
            os.unlink(temp_path)

        raise HTTPException(
            status_code=500,
            detail=f"Could not save brand rules: {exc}",
        ) from exc

    return load_brand_rules()
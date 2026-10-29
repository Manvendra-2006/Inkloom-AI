import json
import re
from pathlib import Path


RULES_FILE = Path(__file__).with_name("brand_rules.json")


def load_brand_rules():
    """Load the brand rules from our JSON knowledge base."""
    with RULES_FILE.open("r", encoding="utf-8") as file:
        return json.load(file)

def validate_brand_rules(rules):
    """Validate rule structure, unique IDs, and guideline references."""
    errors = []

    if not isinstance(rules, dict):
        return ["Brand rules must be a JSON object."]

    if not rules.get("brand_name"):
        errors.append("Missing brand_name.")

    terms = rules.get("terms_requiring_review", [])
    if not isinstance(terms, list):
        return errors + ["terms_requiring_review must be a list."]

    catalog = rules.get("guideline_catalog", [])
    if not isinstance(catalog, list):
        return errors + ["guideline_catalog must be a list."]

    catalog_ids = set()

    for index, guideline in enumerate(catalog):
        prefix = f"Guideline {index + 1}"

        if not isinstance(guideline, dict):
            errors.append(f"{prefix}: must be an object.")
            continue

        guideline_id = guideline.get("guideline_id")
        if not guideline_id:
            errors.append(f"{prefix}: missing guideline_id.")
            continue

        if guideline_id in catalog_ids:
            errors.append(f"{prefix}: duplicate guideline_id {guideline_id}.")
        catalog_ids.add(guideline_id)

        if not guideline.get("title"):
            errors.append(f"{prefix}: missing title.")

        if not guideline.get("description"):
            errors.append(f"{prefix}: missing description.")

    seen_ids = set()

    for index, rule in enumerate(terms):
        prefix = f"Rule {index + 1}"

        if not isinstance(rule, dict):
            errors.append(f"{prefix}: must be an object.")
            continue

        guideline_id = rule.get("guideline_id")

        if not guideline_id:
            errors.append(f"{prefix}: missing guideline_id.")
        elif guideline_id not in catalog_ids:
            errors.append(
                f"{prefix}: guideline_id {guideline_id} "
                "does not exist in guideline_catalog."
            )

        if not guideline_id:
            pass
        elif guideline_id in seen_ids:
            errors.append(f"{prefix}: duplicate guideline_id {guideline_id}.")
        else:
            seen_ids.add(guideline_id)

        if not rule.get("terms") and not rule.get("term"):
            errors.append(f"{prefix}: no searchable term configured.")

        if not rule.get("category"):
            errors.append(f"{prefix}: missing category.")

        if rule.get("severity") not in {"low", "medium", "high"}:
            errors.append(f"{prefix}: invalid severity.")

        if not rule.get("reason"):
            errors.append(f"{prefix}: missing reason.")

    if not isinstance(rules.get("human_review_required"), bool):
        errors.append("human_review_required must be a boolean.")

    return errors

def is_negated(text, match_start):
    """Ignore a flagged term when nearby wording negates it."""
    preceding_text = text[:match_start].lower()

    sentence_start = max(
        preceding_text.rfind("."),
        preceding_text.rfind("!"),
        preceding_text.rfind("?"),
        preceding_text.rfind("\n"),
        preceding_text.rfind(";"),
    )

    context = preceding_text[sentence_start + 1:].strip()
    words = context.split()
    context = " ".join(words[-8:])

    patterns = [
    r"\bnot$",
    r"\bnot\s+(?:make|making|made|offer|offering|offered|provide|providing|claim|claiming|promise|promising)\s+a$",
    r"\bnever\s+(?:make|making|made|offer|offering|offered|provide|providing|claim|claiming|promise|promising)\s+a$",
    r"\bno$",
    r"\bwithout(?:\s+a)?$",
    r"\bdo\s+not$",
    r"\bdoes\s+not$",
    r"\bdid\s+not$",
    r"\bcannot$",
    r"\bcan't$",
    r"\bdon't$",
    r"\bdoesn't$",
    r"\bwon't$",
]

    return any(re.search(pattern, context) for pattern in patterns)

def audit_advertisement(text, rules):
    """Find configured phrases and variations that require brand review."""
    findings = []

    for rule in rules["terms_requiring_review"]:

        terms = rule.get("terms", [rule.get("term", "")])

      
        matching_terms = sorted(
            (term for term in terms if term),
            key=len,
            reverse=True
        )

        for term in matching_terms:
            
            pattern = r"(?<!\w)" + re.escape(term) + r"(?!\w)"

            match = next(
            (
                candidate
                for candidate in re.finditer(
                    pattern, text, flags=re.IGNORECASE
                )
                if not is_negated(text, candidate.start())
            ),
            None
        )


            if match:
                findings.append({
                    "matched_text": match.group(),
                    "category": rule["category"],
                    "severity": rule["severity"],
                    "guideline_id": rule["guideline_id"],
                    "source": rule.get("source", "rule"),
                    "mapping_status": "mapped",
                    "reason": rule["reason"],
                    "explanation": rule["reason"],
                })

                
                break

    return {
        "brand_name": rules["brand_name"],
        "status": "flagged" if findings else "no_flags",
        "findings": findings,
        "human_review_required": rules["human_review_required"]
    }


if __name__ == "__main__":
    brand_rules = load_brand_rules()

    sample_ad = (
        "Our revolutionary product guarantees amazing results. "
        "We are the cheapest option."
    )

    result = audit_advertisement(sample_ad, brand_rules)

    print(json.dumps(result, indent=2))

    errors = validate_brand_rules(brand_rules)
    if errors:
        print("Brand rule validation failed:")
        for error in errors:
            print("-", error)
    else:
        print("Brand rules validated successfully.")
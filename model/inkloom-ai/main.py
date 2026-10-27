import json
import re
from pathlib import Path


RULES_FILE = Path(__file__).with_name("brand_rules.json")


def load_brand_rules():
    """Load the brand rules from our JSON knowledge base."""
    with RULES_FILE.open("r", encoding="utf-8") as file:
        return json.load(file)


def is_negated(text, match_start):
    """Check whether a flagged term is preceded by a nearby negation."""
    preceding_text = text[max(0, match_start - 40):match_start].lower()

    negation_patterns = [
        r"\bnot\b",
        r"\bnever\b",
        r"\bno\b",
        r"\bcannot\b",
        r"\bcan't\b",
        r"\bcant\b",
        r"\bdon't\b",
        r"\bdoesn't\b",
        r"\bdo not\b",
        r"\bdoes not\b",
        r"\bwon't\b",
        r"\bwill not\b",
        r"\bwithout\b",
    ]

    return any(
        re.search(pattern, preceding_text)
        for pattern in negation_patterns
    )

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

                # Only report the first matching variation per rule.
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
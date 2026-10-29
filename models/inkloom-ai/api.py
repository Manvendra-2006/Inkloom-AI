import hashlib
import json
import re
from uuid import uuid4

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from main import audit_advertisement, load_brand_rules
from training.predict import predict as predict_local


app = FastAPI(
    title="Inkloom AI API",
    description="Local-first brand governance and advertisement auditing API",
    version="1.4.0",
)

brands = {}


class OfficialGuidelineRequest(BaseModel):
    guideline_id: str | None = None
    category: str = Field(min_length=1)
    title: str = Field(min_length=1)
    description: str = ""
    rule: str = ""
    examples: str = ""
    severity: str = "medium"
    active: bool = True


class BrandGuidelineRequest(BaseModel):
    name: str = Field(min_length=1)
    description: str = Field(min_length=1)
    tone_of_voice: str = Field(min_length=1)
    preferred_terminology: list[str] = Field(default_factory=list)
    terms_requiring_review: list[str] = Field(default_factory=list)
    guidelines: list[OfficialGuidelineRequest] = Field(default_factory=list)


class AdvertisementRequest(BaseModel):
    text: str = Field(min_length=1)
    brand_id: str | None = None
    brand_guideline: BrandGuidelineRequest | None = None
    image_url: str | None = None


class ImprovementRequest(BaseModel):
    text: str = Field(min_length=1)
    brand_id: str | None = None
    audit_findings: list[dict] = Field(default_factory=list)


class BrandCreate(BaseModel):
    name: str = Field(min_length=1)
    description: str = ""
    tone_of_voice: str = Field(min_length=1)
    preferred_terms: list[str] = Field(default_factory=list)
    terms_requiring_review: list[str] = Field(default_factory=list)


def normalize_text(value: str) -> str:
    value = str(value or "").lower()
    value = re.sub(r"[^\w\s%#-]", " ", value)
    return " ".join(value.split())


def normalize_category(value: str) -> str:
    category = normalize_text(value).replace("_", " ")
    aliases = {
        "claim": "claims",
        "claims": "claims",
        "comparative claim": "comparative claims",
        "comparative claims": "comparative claims",
    }
    return aliases.get(category, category)


def stable_term_guideline_id(term: str) -> str:
    digest = hashlib.sha256(
        normalize_text(term).encode("utf-8")
    ).hexdigest()
    return f"TERM-{digest[:10].upper()}"


def _rule_terms(rule: dict) -> list[str]:
    terms = rule.get("terms")
    if isinstance(terms, list):
        return [str(item) for item in terms if str(item).strip()]

    term = rule.get("term", "")
    return [str(term)] if str(term).strip() else []


def build_profile_rules(profile: dict, baseline_rules: dict) -> list:
    baseline = baseline_rules.get("terms_requiring_review", [])
    configured = []
    seen_ids = set()
    canonical_ids = {"CLAIM-001", "CLAIM-002"}

    for term in profile.get("terms_requiring_review", []):
        term = str(term).strip()
        normalized_term = normalize_text(term)
        if not normalized_term:
            continue

        known_rule = next(
            (
                rule
                for rule in baseline
                if rule.get("guideline_id") in canonical_ids
                and any(
                    normalize_text(alias) == normalized_term
                    for alias in _rule_terms(rule)
                )
            ),
            None,
        )

        if known_rule:
            profile_rule = dict(known_rule)
            profile_rule["source"] = "rule"
        else:
            profile_rule = {
                "terms": [term],
                "category": "brand_custom",
                "severity": "medium",
                "guideline_id": stable_term_guideline_id(term),
                "source": "brand_custom",
                "reason": (
                    f"The term '{term}' requires review under "
                    f"{profile.get('name', 'this brand')} guidelines."
                ),
            }

        guideline_id = str(profile_rule["guideline_id"])
        if guideline_id not in seen_ids:
            configured.append(profile_rule)
            seen_ids.add(guideline_id)

    return configured


def build_mapping_rules(
    profile: dict | None,
    baseline_rules: dict,
) -> list:
    baseline = baseline_rules.get("terms_requiring_review", [])

    if not profile:
        return list(baseline)

    profile_rules = build_profile_rules(profile, baseline_rules)
    profile_terms = {
        normalize_text(term)
        for term in profile.get("terms_requiring_review", [])
        if normalize_text(term)
    }

    mapping_rules = []
    canonical_ids = {"CLAIM-001", "CLAIM-002"}

    for rule in baseline:
        aliases = {
            normalize_text(term)
            for term in _rule_terms(rule)
            if normalize_text(term)
        }

        if aliases & profile_terms and rule.get("guideline_id") not in canonical_ids:
            continue

        mapping_rules.append(rule)

    mapping_rules.extend(profile_rules)

    for guideline in profile.get("guidelines", []):
        if not guideline.get("active", True):
            continue

        guideline_id = guideline.get("guideline_id") or guideline.get("id")
        if not guideline_id:
            continue

        mapping_rules.append({
            "guideline_id": str(guideline_id),
            "category": normalize_category(guideline.get("category", "")),
            "severity": str(guideline.get("severity", "medium")).lower(),
            "terms": [],
            "title": guideline.get("title", ""),
            "description": guideline.get("description", ""),
            "rule": guideline.get("rule", ""),
            "examples": guideline.get("examples", ""),
            "source": "brand_custom",
            "reason": guideline.get("rule") or guideline.get("description") or "",
        })

    unique_rules = []
    seen_ids = set()

    for rule in mapping_rules:
        guideline_id = rule.get("guideline_id")
        if guideline_id and guideline_id not in seen_ids:
            unique_rules.append(rule)
            seen_ids.add(guideline_id)

    return unique_rules


def find_matching_rule(finding: dict, mapping_rules: list) -> dict | None:
    matched_text = str(
        finding.get("matched_text") or finding.get("matchedText") or ""
    )
    normalized_match = normalize_text(matched_text)

    if normalized_match:
        phrase_matches = []

        for rule in mapping_rules:
            for alias in _rule_terms(rule):
                normalized_alias = normalize_text(alias)
                if not normalized_alias:
                    continue

                pattern = r"(?<!\w)" + re.escape(normalized_alias) + r"(?!\w)"
                if re.search(pattern, normalized_match):
                    phrase_matches.append((len(normalized_alias), rule))

        if phrase_matches:
            return max(phrase_matches, key=lambda item: item[0])[1]

    category = normalize_category(finding.get("category", ""))
    category_matches = [
        rule for rule in mapping_rules
        if rule.get("title")
        and normalize_category(rule.get("category", "")) == category
    ]

    if len(category_matches) == 1:
        return category_matches[0]

    ignored = {
        "a", "an", "and", "are", "as", "at", "be", "brand", "by",
        "for", "from", "guideline", "in", "is", "it", "of", "on",
        "or", "the", "this", "to", "with", "should", "must", "may",
        "claim", "claims", "tone", "terminology", "issue", "wording",
    }

    def words(value: str) -> set[str]:
        return {
            word
            for word in re.findall(r"[\w%-]+", normalize_text(value))
            if len(word) > 2 and word not in ignored
        }

    finding_words = words(" ".join(
        str(finding.get(field, ""))
        for field in ("matched_text", "reason", "explanation", "issue")
    ))

    scores = []
    for rule in category_matches:
        rule_words = words(" ".join(
            str(rule.get(field, ""))
            for field in ("title", "description", "rule", "examples")
        ))
        score = len(finding_words & rule_words)
        if score:
            scores.append((score, rule))

    if scores:
        best_score = max(score for score, _ in scores)
        best = [rule for score, rule in scores if score == best_score]
        if len(best) == 1:
            return best[0]

    return None


def matched_text_exists_in_ad(matched_text: str, ad_text: str) -> bool:
    matched_text = str(matched_text or "").strip()
    if not matched_text or not ad_text.strip():
        return False

    pattern = r"(?<!\w)" + re.escape(matched_text) + r"(?!\w)"
    return re.search(pattern, ad_text, flags=re.IGNORECASE) is not None


def normalize_ai_findings(
    findings: list,
    mapping_rules: list,
    preferred_terminology: list | None = None,
    ad_text: str = "",
) -> list:
    normalized = []
    preferred = {
        normalize_text(term)
        for term in (preferred_terminology or [])
        if normalize_text(term)
    }
    configured_ids = {
        str(rule["guideline_id"])
        for rule in mapping_rules
        if rule.get("guideline_id")
    }

    for original in findings:
        if not isinstance(original, dict):
            continue

        finding = dict(original)
        matched = str(
            finding.get("matched_text") or finding.get("matchedText") or ""
        ).strip()

        if ad_text and not matched_text_exists_in_ad(matched, ad_text):
            continue

        supplied_id = finding.get("guideline_id")
        rule = None

        if supplied_id and str(supplied_id) in configured_ids:
            rule = next(
                (
                    candidate for candidate in mapping_rules
                    if str(candidate.get("guideline_id")) == str(supplied_id)
                ),
                None,
            )

        if rule is None:
            rule = find_matching_rule(finding, mapping_rules)

        reason = (
            finding.get("reason")
            or finding.get("explanation")
            or finding.get("issue")
            or ""
        )
        category = normalize_category(finding.get("category", ""))
        normalized_match = normalize_text(matched)

        is_terminology = category in {"terminology", "preferred terminology"}
        preferred_match = any(term in normalized_match for term in preferred)
        preferred_reason = is_terminology and any(
            phrase in normalize_text(reason)
            for phrase in ("preferred term", "preferred terminology", "approved term")
        )

        if is_terminology and (preferred_match or preferred_reason):
            continue

        finding.update({
            "guideline_id": str(rule["guideline_id"]) if rule else None,
            "source": "ai",
            "mapping_status": "mapped" if rule else "unmapped",
            "category": finding.get("category") or (
                rule.get("category") if rule else "unknown"
            ),
            "severity": str(
                finding.get("severity")
                or (rule.get("severity") if rule else "medium")
            ).lower(),
            "matched_text": matched,
            "reason": reason,
        })
        normalized.append(finding)

    return normalized


def severity_rank(value: str) -> int:
    return {"low": 1, "medium": 2, "high": 3, "critical": 4}.get(
        str(value or "").lower(), 0
    )


def categories_compatible(category_a: str, category_b: str) -> bool:
    a, b = normalize_category(category_a), normalize_category(category_b)
    if a == b:
        return True
    compatible = {"claims", "comparative claims"}
    return a in compatible and b in compatible


def texts_overlap(text_a: str, text_b: str) -> bool:
    a, b = normalize_text(text_a), normalize_text(text_b)
    if not a or not b:
        return False
    if a in b or b in a:
        return True

    meaningful = {
        "guarantee", "guarantees", "guaranteed", "cheapest",
        "sales", "comparative", "performance", "risk-free",
        "success", "lowest", "price", "claims", "claim",
    }
    return bool(set(a.split()) & set(b.split()) & meaningful)


def combine_findings(rule_result: dict, ai_result: dict) -> list:
    combined = []

    def add_or_merge(finding: dict, fallback_source: str):
        if not isinstance(finding, dict):
            return

        item = dict(finding)
        matched = str(item.get("matched_text", ""))
        source = item.get("source") or fallback_source
        item["source"] = source
        item["sources"] = list(dict.fromkeys(item.get("sources", []) + [source]))
        item.setdefault(
            "mapping_status",
            "mapped" if item.get("guideline_id") else "unmapped",
        )
        item.setdefault("reason", item.get("explanation") or item.get("issue") or "")

        for existing in combined:
            same_id = (
                item.get("guideline_id")
                and existing.get("guideline_id") == item.get("guideline_id")
                and (
                    not str(existing.get("matched_text", "")).strip()
                    or not matched.strip()
                    or texts_overlap(existing.get("matched_text", ""), matched)
                )
            )
            same_unmapped = (
                not item.get("guideline_id")
                and not existing.get("guideline_id")
                and categories_compatible(
                    existing.get("category", ""), item.get("category", "")
                )
                and texts_overlap(existing.get("matched_text", ""), matched)
            )

            if not (same_id or same_unmapped):
                continue

            if len(matched) > len(str(existing.get("matched_text", ""))):
                existing["matched_text"] = matched

            existing["sources"] = list(dict.fromkeys(existing.get("sources", []) + item["sources"]))
            existing.setdefault("source_findings", []).append(item)

            extra = item.get("explanation") or item.get("reason") or ""
            if extra and extra != existing.get("explanation"):
                extras = existing.setdefault("additional_explanations", [])
                if extra not in extras:
                    extras.append(extra)

            reason = item.get("reason", "")
            if reason and reason != existing.get("reason"):
                reasons = existing.setdefault("additional_reasons", [])
                if reason not in reasons:
                    reasons.append(reason)

            if severity_rank(item.get("severity")) > severity_rank(existing.get("severity")):
                existing["severity"] = item["severity"]
            return

        combined.append(item)

    for finding in rule_result.get("findings", []):
        add_or_merge(finding, "rule_based")
    for finding in ai_result.get("findings", []):
        add_or_merge(finding, "ai")

    return combined


def run_local_classifier(text: str) -> dict:
    """Run the experimental locally trained classifier as a secondary signal."""
    try:
        label, confidence = predict_local(text)
        return {
            "label": label,
            "confidence": round(float(confidence), 4),
            "source": "local_ml",
            "status": "available",
            "human_review_required": True,
            "note": (
                "Experimental model signal only. Rule findings and a human "
                "review remain authoritative."
            ),
        }
    except (OSError, RuntimeError, ValueError, KeyError, TypeError) as error:
        return {
            "label": "REVIEW_CONTEXT",
            "confidence": 0.0,
            "source": "local_ml",
            "status": "unavailable",
            "human_review_required": True,
            "note": f"Local classifier unavailable: {error}",
        }


def make_local_suggestions(
    text: str,
    findings: list[dict],
) -> dict:
    """Conservative, deterministic suggestions; never invent product facts."""
    replacements = [
        (r"\bguarantees?\b", "is designed to help"),
        (r"\bguaranteed\b", "is designed to help"),
        (r"\b2x more sales in just 30 days\b", "improve your workflow"),
        (r"\b2x sales\b", "improve your workflow"),
        (r"\bdouble your sales\b", "improve your workflow"),
        (r"\bcheapest\b", "a solution for your team's needs"),
        (r"\bbest in the market\b", "a solution for your team's needs"),
        (r"\bnumber one\b", "a solution for your team's needs"),
        (r"\brisk-free\b", "with clearly explained terms"),
        (r"\bzero risk\b", "with clearly explained terms"),
        (r"\bno risk\b", "with clearly explained terms"),
    ]

    revised = text
    suggestions = []
    for pattern, replacement in replacements:
        revised, count = re.subn(pattern, replacement, revised, flags=re.IGNORECASE)
        if count:
            suggestions.append({
                "original_text": pattern,
                "suggested_replacement": replacement,
                "reason": "This wording may need substantiation or a more precise claim.",
                "priority": "high",
            })

    return {
        "suggestions": suggestions,
        "revised_draft": revised if revised != text else "",
        "human_review_required": True,
        "original_text_unchanged": True,
    }


@app.get("/health")
def health_check():
    model_signal = run_local_classifier("A neutral sample advertisement.")
    return {
        "status": "healthy",
        "service": "Inkloom AI API",
        "local_classifier": model_signal["status"],
    }


@app.get("/brand-rules")
def get_brand_rules():
    try:
        return load_brand_rules()
    except (OSError, ValueError, KeyError) as error:
        raise HTTPException(
            status_code=500,
            detail=f"Could not load brand rules: {error}",
        )


@app.post("/brands", status_code=201)
def create_brand(brand: BrandCreate):
    name = brand.name.strip()
    tone = brand.tone_of_voice.strip()
    if not name:
        raise HTTPException(status_code=422, detail="Brand name cannot be blank.")
    if not tone:
        raise HTTPException(status_code=422, detail="Brand tone of voice cannot be blank.")

    brand_id = str(uuid4())
    brand_data = {
        "id": brand_id,
        "name": name,
        "description": brand.description.strip(),
        "tone_of_voice": tone,
        "preferred_terms": [term.strip() for term in brand.preferred_terms if term.strip()],
        "terms_requiring_review": [
            term.strip() for term in brand.terms_requiring_review if term.strip()
        ],
    }
    brands[brand_id] = brand_data
    return {"message": "Brand registered successfully", "brand": brand_data}


@app.get("/brands")
def list_brands():
    return {"brands": list(brands.values())}


@app.post("/audit")
def audit_ad(request: AdvertisementRequest):
    text = request.text.strip()
    if not text:
        raise HTTPException(status_code=422, detail="Advertisement text cannot be blank.")

    try:
        baseline_rules = load_brand_rules()
        rules = dict(baseline_rules)
        profile = None

        if request.brand_guideline is not None:
            profile = request.brand_guideline.model_dump()
        elif request.brand_id:
            brand = brands.get(request.brand_id)
            if brand is None:
                raise HTTPException(
                    status_code=404,
                    detail="Brand not found. Register the brand again and use its current ID.",
                )
            profile = {
                "name": brand["name"],
                "description": brand["description"],
                "tone_of_voice": brand["tone_of_voice"],
                "preferred_terminology": brand["preferred_terms"],
                "terms_requiring_review": brand["terms_requiring_review"],
                "guidelines": [],
            }

        if profile is not None:
            profile["name"] = profile["name"].strip()
            profile["description"] = profile["description"].strip()
            profile["tone_of_voice"] = profile["tone_of_voice"].strip()
            profile["preferred_terminology"] = [
                term.strip() for term in profile["preferred_terminology"] if term.strip()
            ]
            profile["terms_requiring_review"] = [
                term.strip() for term in profile["terms_requiring_review"] if term.strip()
            ]
            profile["guidelines"] = [
                guideline for guideline in profile.get("guidelines", [])
                if isinstance(guideline, dict)
            ]
            if not all([profile["name"], profile["description"], profile["tone_of_voice"]]):
                raise HTTPException(
                    status_code=422,
                    detail="Brand name, description, and tone of voice must be provided.",
                )
            rules["brand_name"] = profile["name"]
            rules["terms_requiring_review"] = build_profile_rules(profile, baseline_rules)

        rule_result = audit_advertisement(text, rules)
        mapping_rules = build_mapping_rules(profile, baseline_rules)

        
        model_signal = run_local_classifier(text)
        ai_result = {
            "findings": [],
            "human_review_required": True,
            "ai_status": "local_model",
            "model_signal": model_signal,
        }

        combined = combine_findings(rule_result, ai_result)
        return {
            "brand_name": rules.get("brand_name", "Inkloom Demo Brand"),
            "brand_guideline": profile,
            "status": "flagged" if combined else "no_flags",
            "combined_findings": combined,
            "finding_count": len(combined),
            "rule_based": rule_result,
            "ai_review": ai_result,
            "model_signal": model_signal,
            "human_review_required": True,
        }

    except HTTPException:
        raise
    except (OSError, ValueError, KeyError, TypeError) as error:
        raise HTTPException(status_code=500, detail=f"Audit failed: {error}")


@app.post("/suggest-improvements")
def improve_ad(request: ImprovementRequest):
    text = request.text.strip()
    if not text:
        raise HTTPException(status_code=422, detail="Advertisement text cannot be blank.")

    brand = None
    if request.brand_id:
        brand = brands.get(request.brand_id)
        if brand is None:
            raise HTTPException(
                status_code=404,
                detail="Brand not found. Register the brand again and use its current ID.",
            )

    result = make_local_suggestions(text, request.audit_findings)
    return {
        "message": "Local improvement suggestions generated",
        "brand_name": brand["name"] if brand else "Inkloom Demo Brand",
        "suggestions": result["suggestions"],
        "revised_draft": result["revised_draft"],
        "human_review_required": True,
        "original_text_unchanged": True,
        "source": "local_rules",
    }
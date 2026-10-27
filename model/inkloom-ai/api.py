import logging

from fastapi import FastAPI, HTTPException, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel, Field
from fastapi.responses import JSONResponse
from uuid import uuid4
import hashlib
import json
import re
import requests

from main import load_brand_rules, audit_advertisement


app = FastAPI(
    title="Inkloom AI API",
    description="Brand governance and advertisement auditing API",
    version="1.2.0",
)

logger = logging.getLogger(__name__)


@app.exception_handler(RequestValidationError)
async def log_request_validation_error(request: Request, error: RequestValidationError):
    logger.error(
        "FastAPI request validation failed: method=%s path=%s errors=%s",
        request.method,
        request.url.path,
        error.errors(),
    )
    return JSONResponse(
        status_code=422,
        content=jsonable_encoder({"detail": error.errors()}),
    )


brands = {}


class OfficialGuidelineRequest(BaseModel):
    guideline_id: str | None = None
    category: str = Field(min_length=1)
    title: str = Field(min_length=1)
    description: str = ""
    rule: str = ""
    examples: str = ""
    severity: str = "MEDIUM"
    active: bool = True


class BrandGuidelineRequest(BaseModel):
    id: str | None = None
    version: str = "1.0"
    is_active: bool = True
    name: str = Field(min_length=1)
    description: str = Field(min_length=1)
    tone_of_voice: str = Field(min_length=1)
    preferred_terminology: list[str] = Field(default_factory=list)
    terms_requiring_review: list[str] = Field(default_factory=list)
    guidelines: list[OfficialGuidelineRequest] = Field(default_factory=list)


class AdvertisementRequest(BaseModel):
    text: str = Field(
        min_length=1,
        description="Advertisement copy to audit",
    )
    brand_id: str | None = Field(
        default=None,
        description="Optional ID of a registered brand",
    )
    brand_guideline: BrandGuidelineRequest | None = Field(
        default=None,
        description="Complete brand profile to use for this audit",
    )
    image_url: str | None = Field(
        default=None,
        description="Optional advertisement image URL; not analyzed by the model",
    )


class ImprovementFindingRequest(BaseModel):
    guideline_id: str | None = None
    source: str = "ai"
    mapping_status: str = "unmapped"
    category: str = ""
    severity: str = "medium"
    matched_text: str = Field(min_length=1)
    reason: str = ""


class AdvertisementImprovementRequest(BaseModel):
    title: str = Field(min_length=1)
    caption: str = ""
    brand_guideline: BrandGuidelineRequest
    findings: list[ImprovementFindingRequest] = Field(default_factory=list)


class BrandCreate(BaseModel):
    name: str = Field(
        min_length=1,
        description="Brand name",
    )
    description: str = Field(
        default="",
        description="What the brand does",
    )
    tone_of_voice: str = Field(
        min_length=1,
        description="Preferred brand communication style",
    )
    preferred_terms: list[str] = Field(
        default_factory=list,
        description="Words and phrases the brand prefers",
    )
    terms_requiring_review: list[str] = Field(
        default_factory=list,
        description="Terms that should trigger a compliance review",
    )


def review_with_ollama(ad_text: str, brand_guideline: dict):
    """Use local Ollama to identify potential compliance risks."""

    preferred_terminology = ", ".join(
        brand_guideline.get("preferred_terminology", [])
    )

    terms_requiring_review = ", ".join(
        brand_guideline.get("terms_requiring_review", [])
    )

    active_guidelines = [
        guideline
        for guideline in brand_guideline.get("guidelines", [])
        if guideline.get("active", True)
    ]

    official_guidelines = json.dumps(
        active_guidelines,
        ensure_ascii=False,
        indent=2,
    )

    prompt = f"""
You are an AI brand compliance reviewer.

Review the advertisement against the supplied official brand profile.
The supplied brand profile is the source of truth.

Brand name:
{brand_guideline.get("name", "")}

Brand description:
{brand_guideline.get("description", "")}

Preferred tone of voice:
{brand_guideline.get("tone_of_voice", "")}

Preferred terminology:
{preferred_terminology}

Terms requiring review:
{terms_requiring_review}

Additional active official guidelines (JSON):
{official_guidelines}

Advertisement:
{ad_text}

Check for:
1. Tone conflicts with the supplied preferred tone.
2. Incorrect or missing preferred terminology where relevant.
3. Use of terms requiring review.
4. Unsupported claims.
5. Exaggerated or misleading messaging.
6. Messaging that conflicts with the brand description.
7. Apply each active official guideline, including its category, rule, severity, and examples.
8. Other issues directly supported by the supplied brand profile.

Do not invent brand rules that are not present in the supplied brand profile.

IMPORTANT MATCHING RULES:
- Only report a finding when the matched wording actually appears in the supplied advertisement.
- Never invent or hallucinate matched wording.
- Do not report a term merely because that term exists in the brand guidelines.
- matched_text MUST be copied exactly from the advertisement text.
- If the wording is not present in the advertisement, do not create a finding.
- Do not assume that a guideline term is present in the advertisement.
- Do not create a finding based only on the brand profile.
- Every finding must be directly supported by the supplied advertisement text.

Important:
- A flag is a potential risk, not proof of a violation.
- Do not claim facts are verified without evidence.
- Consider negation and qualification in the wording.
- Preferred terminology is approved/recommended wording. Do not flag it as a violation,
  and do not flag copy merely because it does not contain a longer preferred phrase.
- Do not invent tone violations. A tone finding must be supported by a supplied
  official guideline; otherwise leave guideline_id null.
- Return an empty findings list when no supported risk exists.
- A human reviewer must make the final decision.
- Use exact phrases from the advertisement for matched_text.
- Severity must be high, medium, or low.
- Only use guideline IDs supplied with the official profile or known deterministic rules.
  Return null when no configured guideline supports the finding.
- Avoid returning multiple findings for the same underlying issue.
- Return valid JSON only.

Return this JSON structure:
{{
  "findings": [
    {{
      "category": "Claims",
      "severity": "high",
      "matched_text": "the exact phrase from the advertisement",
      "guideline_id": "a supplied guideline ID, or null",
      "reason": "Why this phrase may need review"
    }}
  ],
  "human_review_required": true
}}
"""

    response = requests.post(
        "http://localhost:11434/api/generate",
        json={
            "model": "llama3:latest",
            "prompt": prompt,
            "stream": False,
            "format": "json",
            "options": {"temperature": 0},
        },
        timeout=90,
    )

    response.raise_for_status()

    result = response.json()
    return result["response"]


def normalize_text(value: str) -> str:
    """Normalize text for comparisons without changing displayed text."""

    value = str(value or "").lower()
    value = re.sub(r"[^\w\s%#-]", " ", value)
    return " ".join(value.split())


def normalize_category(value: str) -> str:
    """Make common category variations comparable."""

    category = normalize_text(value).replace("_", " ")

    aliases = {
        "claim": "claims",
        "claims": "claims",
        "comparative claim": "comparative claims",
        "comparative claims": "comparative claims",
    }

    return aliases.get(category, category)


def stable_term_guideline_id(term: str) -> str:
    """Create a repeatable ID for a reviewed term stored as plain profile text."""

    digest = hashlib.sha256(
        normalize_text(term).encode("utf-8")
    ).hexdigest()

    return f"TERM-{digest[:10].upper()}"


def build_profile_rules(profile: dict, baseline_rules: dict) -> list:
    """Resolve reviewed terms to known rules or stable profile-specific IDs."""

    baseline = baseline_rules.get("terms_requiring_review", [])
    configured = []
    seen_ids = set()

    for term in profile.get("terms_requiring_review", []):
        normalized_term = normalize_text(term)

        if not normalized_term:
            continue

        known_rule = next(
            (
                rule
                for rule in baseline
                if any(
                    normalize_text(alias) == normalized_term
                    for alias in rule.get(
                        "terms",
                        [rule.get("term", "")],
                    )
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
                    f"The term '{term}' requires review "
                    f"under {profile['name']} guidelines."
                ),
            }

        if profile_rule["guideline_id"] not in seen_ids:
            configured.append(profile_rule)
            seen_ids.add(profile_rule["guideline_id"])

    return configured


def build_mapping_rules(
    profile: dict | None,
    baseline_rules: dict,
) -> list:
    """Create the set of configured IDs eligible to map AI findings."""

    mapping_rules = list(
        baseline_rules.get("terms_requiring_review", [])
    )

    if not profile:
        return mapping_rules

    mapping_rules.extend(
        build_profile_rules(
            profile,
            baseline_rules,
        )
    )

    for guideline in profile.get("guidelines", []):

        if not guideline.get("active", True):
            continue

        guideline_id = (
            guideline.get("guideline_id")
            or guideline.get("id")
        )

        if not guideline_id:
            continue

        mapping_rules.append({
            "guideline_id": str(guideline_id),
            "category": normalize_category(
                guideline.get("category", "")
            ),
            "severity": str(
                guideline.get("severity", "medium")
            ).lower(),
            "terms": [],
            "title": guideline.get("title", ""),
            "description": guideline.get("description", ""),
            "rule": guideline.get("rule", ""),
            "examples": guideline.get("examples", ""),
            "source": "brand_custom",
            "reason": (
                guideline.get("rule")
                or guideline.get("description")
                or ""
            ),
        })

    return mapping_rules


def find_matching_rule(
    finding: dict,
    mapping_rules: list,
) -> dict | None:
    """Map findings to the most specific configured phrase or official rule."""

    matched_text = str(
        finding.get("matched_text")
        or finding.get("matchedText")
        or ""
    )

    normalized_match = normalize_text(matched_text)

    if normalized_match:
        phrase_matches = []

        for rule in mapping_rules:

            aliases = rule.get(
                "terms",
                [rule.get("term", "")],
            )

            for alias in aliases:

                normalized_alias = normalize_text(alias)

                if not normalized_alias:
                    continue

                if re.search(
                    r"(?<!\w)"
                    + re.escape(normalized_alias)
                    + r"(?!\w)",
                    normalized_match,
                ):
                    phrase_matches.append(
                        (
                            len(normalized_alias),
                            rule,
                        )
                    )

        if phrase_matches:
            return max(
                phrase_matches,
                key=lambda match: match[0],
            )[1]

    finding_category = normalize_category(
        finding.get("category", "")
    )

    if finding_category:

        category_matches = [
            rule
            for rule in mapping_rules
            if rule.get("title")
            and normalize_category(
                rule.get("category", "")
            ) == finding_category
        ]

        if len(category_matches) == 1:
            return category_matches[0]

        ignored_words = {
            "a",
            "an",
            "and",
            "are",
            "as",
            "at",
            "be",
            "brand",
            "by",
            "for",
            "from",
            "guideline",
            "in",
            "is",
            "it",
            "of",
            "on",
            "or",
            "the",
            "this",
            "to",
            "with",
            "should",
            "must",
            "may",
            "claim",
            "claims",
            "tone",
            "terminology",
            "issue",
            "wording",
        }

        def meaningful_words(value: str) -> set:
            return {
                word
                for word in re.findall(
                    r"[\w%-]+",
                    normalize_text(value),
                )
                if len(word) > 2
                and word not in ignored_words
            }

        finding_words = meaningful_words(
            " ".join(
                str(finding.get(field, ""))
                for field in (
                    "matched_text",
                    "reason",
                    "explanation",
                    "issue",
                )
            )
        )

        scored_matches = []

        for rule in category_matches:

            rule_words = meaningful_words(
                " ".join(
                    str(rule.get(field, ""))
                    for field in (
                        "title",
                        "description",
                        "rule",
                        "examples",
                    )
                )
            )

            score = len(
                finding_words & rule_words
            )

            if score:
                scored_matches.append(
                    (
                        score,
                        rule,
                    )
                )

        if scored_matches:

            highest_score = max(
                score
                for score, _ in scored_matches
            )

            best_matches = [
                rule
                for score, rule in scored_matches
                if score == highest_score
            ]

            if len(best_matches) == 1:
                return best_matches[0]

    return None


def matched_text_exists_in_ad(
    matched_text: str,
    ad_text: str,
) -> bool:
    """
    Verify that AI-reported matched_text actually exists
    in the advertisement.

    This prevents LLM hallucinations such as reporting
    '100% success' when that phrase is not present.
    """

    matched_text = str(
        matched_text or ""
    ).strip()

    ad_text = str(
        ad_text or ""
    )

    if not matched_text:
        return False

    if not ad_text.strip():
        return False

    pattern = (
        r"(?<!\w)"
        + re.escape(matched_text)
        + r"(?!\w)"
    )

    return re.search(
        pattern,
        ad_text,
        flags=re.IGNORECASE,
    ) is not None


def normalize_ai_findings(
    findings: list,
    mapping_rules: list,
    preferred_terminology: list | None = None,
    ad_text: str = "",
) -> list:
    """
    Preserve AI metadata while assigning only supported guideline IDs.

    IMPORTANT:
    Every AI finding must first pass an exact matched-text
    validation against the actual advertisement text.
    """

    normalized = []

    approved_terms = {
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

        matched_text = (
            finding.get("matched_text")
            or finding.get("matchedText")
            or ""
        )

        matched_text = str(
            matched_text
        ).strip()

        # ---------------------------------------------------------
        # CRITICAL FALSE-POSITIVE PROTECTION
        # ---------------------------------------------------------
        # If the AI says that a phrase exists but that phrase
        # does not actually exist in the advertisement,
        # discard the AI finding.
        #
        # Example:
        #
        # Advertisement:
        # "Designed to help customers stay active."
        #
        # AI:
        # matched_text = "100% success"
        #
        # Result:
        # Finding is discarded.
        # ---------------------------------------------------------

        if not matched_text_exists_in_ad(
            matched_text,
            ad_text,
        ):
            continue

        supplied_id = finding.get(
            "guideline_id"
        )

        rule = (
            next(
                (
                    candidate
                    for candidate in mapping_rules
                    if str(
                        candidate.get("guideline_id")
                    ) == str(supplied_id)
                ),
                None,
            )
            if supplied_id
            and str(supplied_id) in configured_ids
            else None
        )

        if rule is None:
            rule = find_matching_rule(
                finding,
                mapping_rules,
            )

        reason = (
            finding.get("reason")
            or finding.get("explanation")
            or finding.get("issue")
            or ""
        )

        finding_category = normalize_category(
            finding.get("category", "")
        )

        preferred_term_concern = (
            finding_category
            in {
                "terminology",
                "preferred terminology",
            }
            and any(
                term in normalize_text(matched_text)
                for term in approved_terms
            )
        )

        references_preferred_wording = (
            finding_category
            in {
                "terminology",
                "preferred terminology",
            }
            and any(
                phrase in normalize_text(reason)
                for phrase in (
                    "preferred term",
                    "preferred terminology",
                    "approved term",
                )
            )
        )

        if rule is None and (
            preferred_term_concern
            or references_preferred_wording
        ):
            continue

        finding.update({
            "guideline_id": (
                str(rule["guideline_id"])
                if rule
                else None
            ),
            "source": "ai",
            "mapping_status": (
                "mapped"
                if rule
                else "unmapped"
            ),
            "category": (
                finding.get("category")
                or (
                    rule.get("category")
                    if rule
                    else "unknown"
                )
            ),
            "severity": str(
                finding.get("severity")
                or (
                    rule.get("severity")
                    if rule
                    else "medium"
                )
            ).lower(),
            "matched_text": matched_text,
            "reason": reason,
        })

        normalized.append(finding)

    return normalized


def severity_rank(value: str) -> int:
    """Return a numeric severity rank."""

    return {
        "low": 1,
        "medium": 2,
        "high": 3,
        "critical": 4,
    }.get(
        str(value or "").lower(),
        0,
    )


def categories_compatible(
    category_a: str,
    category_b: str,
) -> bool:
    """Check whether two categories can describe the same issue."""

    a = normalize_category(category_a)
    b = normalize_category(category_b)

    if a == b:
        return True

    compatible = {
        "claims",
        "comparative claims",
    }

    return (
        a in compatible
        and b in compatible
    )


def texts_overlap(
    text_a: str,
    text_b: str,
) -> bool:
    """
    Detect likely duplicate phrases.

    Uses exact containment first, then shared meaningful words.
    This is a heuristic, so final review remains necessary.
    """

    a = normalize_text(text_a)
    b = normalize_text(text_b)

    if not a or not b:
        return False

    if a in b or b in a:
        return True

    words_a = set(a.split())
    words_b = set(b.split())

    meaningful_words = {
        "guarantee",
        "guarantees",
        "guaranteed",
        "cheapest",
        "sales",
        "comparative",
        "performance",
        "risk-free",
        "success",
        "lowest",
        "price",
        "claims",
        "claim",
    }

    return bool(
        words_a
        & words_b
        & meaningful_words
    )


def combine_findings(
    rule_result: dict,
    ai_result: dict,
) -> list:
    """
    Merge overlapping findings from both engines.

    Preserves the original explanation, stores additional explanations,
    tracks both sources, and retains the highest recognized severity.
    """

    combined = []

    def add_or_merge(
        finding: dict,
        fallback_source: str,
    ):
        if not isinstance(finding, dict):
            return

        item = dict(finding)

        matched_text = str(
            item.get("matched_text", "")
        )

        item_source = (
            item.get("source")
            or fallback_source
        )

        item["source"] = item_source

        item["sources"] = list(
            dict.fromkeys(
                item.get("sources", [])
                + [item_source]
            )
        )

        item.setdefault(
            "mapping_status",
            (
                "mapped"
                if item.get("guideline_id")
                else "unmapped"
            ),
        )

        item.setdefault(
            "reason",
            item.get("explanation")
            or item.get("issue")
            or "",
        )

        for existing in combined:

            same_guideline = (
                item.get("guideline_id")
                and existing.get(
                    "guideline_id"
                )
                == item.get(
                    "guideline_id"
                )
                and (
                    not str(
                        existing.get(
                            "matched_text",
                            "",
                        )
                    ).strip()
                    or not matched_text.strip()
                    or texts_overlap(
                        existing.get(
                            "matched_text",
                            "",
                        ),
                        matched_text,
                    )
                )
            )

            same_unmapped_issue = (
                not item.get("guideline_id")
                and not existing.get(
                    "guideline_id"
                )
                and categories_compatible(
                    existing.get(
                        "category",
                        "",
                    ),
                    item.get(
                        "category",
                        "",
                    ),
                )
                and texts_overlap(
                    existing.get(
                        "matched_text",
                        "",
                    ),
                    matched_text,
                )
            )

            if not (
                same_guideline
                or same_unmapped_issue
            ):
                continue

            if len(matched_text) > len(
                str(
                    existing.get(
                        "matched_text",
                        "",
                    )
                )
            ):
                existing["matched_text"] = (
                    matched_text
                )

            existing["sources"] = list(
                dict.fromkeys(
                    existing.get(
                        "sources",
                        [],
                    )
                    + item["sources"]
                )
            )

            additional_findings = (
                existing.setdefault(
                    "source_findings",
                    [],
                )
            )

            additional_findings.append(
                item
            )

            additional_explanation = (
                item.get("explanation")
                or item.get("reason")
                or ""
            )

            if (
                additional_explanation
                and additional_explanation
                != existing.get(
                    "explanation"
                )
            ):
                explanations = (
                    existing.setdefault(
                        "additional_explanations",
                        [],
                    )
                )

                if (
                    additional_explanation
                    not in explanations
                ):
                    explanations.append(
                        additional_explanation
                    )

            if (
                item.get("reason")
                and item["reason"]
                != existing.get("reason")
            ):
                reasons = (
                    existing.setdefault(
                        "additional_reasons",
                        [],
                    )
                )

                if (
                    item["reason"]
                    not in reasons
                ):
                    reasons.append(
                        item["reason"]
                    )

            old_severity = existing.get(
                "severity",
                "",
            )

            new_severity = item.get(
                "severity",
                "",
            )

            if (
                severity_rank(new_severity)
                > severity_rank(old_severity)
            ):
                existing["severity"] = (
                    new_severity
                )

            return

        combined.append(item)

    # Add rule-based findings first so their guideline IDs
    # and deterministic explanations are preserved.
    for finding in rule_result.get(
        "findings",
        [],
    ):
        add_or_merge(
            finding,
            "rule_based",
        )

    # Merge validated AI findings.
    for finding in ai_result.get(
        "findings",
        [],
    ):
        add_or_merge(
            finding,
            "ai",
        )

    return combined


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "Inkloom AI API",
    }


@app.get("/brand-rules")
def get_brand_rules():
    try:
        return load_brand_rules()

    except (
        OSError,
        ValueError,
        KeyError,
    ) as error:

        raise HTTPException(
            status_code=500,
            detail=(
                f"Could not load brand rules: {error}"
            ),
        )


@app.post("/brands", status_code=201)
def create_brand(
    brand: BrandCreate,
):
    name = brand.name.strip()
    tone = brand.tone_of_voice.strip()

    if not name:
        raise HTTPException(
            status_code=422,
            detail="Brand name cannot be blank.",
        )

    if not tone:
        raise HTTPException(
            status_code=422,
            detail=(
                "Brand tone of voice cannot be blank."
            ),
        )

    brand_id = str(uuid4())

    brand_data = {
        "id": brand_id,
        "name": name,
        "description": brand.description.strip(),
        "tone_of_voice": tone,
        "preferred_terms": [
            term.strip()
            for term in brand.preferred_terms
            if term.strip()
        ],
        "terms_requiring_review": [
            term.strip()
            for term in brand.terms_requiring_review
            if term.strip()
        ],
    }

    brands[brand_id] = brand_data

    return {
        "message": "Brand registered successfully",
        "brand": brand_data,
    }


@app.post("/audit")
def audit_ad(
    request: AdvertisementRequest,
):
    text = request.text.strip()

    if not text:
        raise HTTPException(
            status_code=422,
            detail=(
                "Advertisement text cannot be blank."
            ),
        )
    
    try:

        # ---------------------------------------------------------
        # LOAD STANDARD RULES
        # ---------------------------------------------------------

        baseline_rules = load_brand_rules()
        rules = dict(baseline_rules)

        # ---------------------------------------------------------
        # LOAD BRAND PROFILE
        # ---------------------------------------------------------

        profile = None
        brand_guideline = request.brand_guideline

        if brand_guideline is not None:

            profile = (
                brand_guideline.model_dump()
                if hasattr(
                    brand_guideline,
                    "model_dump",
                )
                else brand_guideline.dict()
            )

        elif request.brand_id:

            brand = brands.get(
                request.brand_id
            )

            if brand is None:
                raise HTTPException(
                    status_code=404,
                    detail=(
                        "Brand not found. "
                        "Register the brand again "
                        "and use its current ID."
                    ),
                )

            profile = {
                "name": brand["name"],
                "description": brand["description"],
                "tone_of_voice": brand["tone_of_voice"],
                "preferred_terminology": brand[
                    "preferred_terms"
                ],
                "terms_requiring_review": brand[
                    "terms_requiring_review"
                ],
                "guidelines": [],
            }

        # ---------------------------------------------------------
        # CLEAN BRAND PROFILE
        # ---------------------------------------------------------

        if profile is not None:

            profile["name"] = (
                profile["name"].strip()
            )

            profile["description"] = (
                profile["description"].strip()
            )

            profile["tone_of_voice"] = (
                profile["tone_of_voice"].strip()
            )

            profile["preferred_terminology"] = [
                term.strip()
                for term in profile[
                    "preferred_terminology"
                ]
                if term.strip()
            ]

            profile["terms_requiring_review"] = [
                term.strip()
                for term in profile[
                    "terms_requiring_review"
                ]
                if term.strip()
            ]

            profile["guidelines"] = [
                guideline
                for guideline in profile.get(
                    "guidelines",
                    [],
                )
                if isinstance(
                    guideline,
                    dict,
                )
            ]

            if not all(
                [
                    profile["name"],
                    profile["description"],
                    profile["tone_of_voice"],
                ]
            ):
                raise HTTPException(
                    status_code=422,
                    detail=(
                        "Brand name, description, "
                        "and tone of voice must be provided."
                    ),
                )

            rules["brand_name"] = profile[
                "name"
            ]

            rules[
                "terms_requiring_review"
            ] = build_profile_rules(
                profile,
                baseline_rules,
            )

        # ---------------------------------------------------------
        # DETERMINISTIC RULE-BASED AUDIT
        # ---------------------------------------------------------

        rule_result = audit_advertisement(
            text,
            rules,
        )

        mapping_rules = build_mapping_rules(
            profile,
            baseline_rules,
        )

        # ---------------------------------------------------------
        # AI REVIEW
        # ---------------------------------------------------------

        try:

            ai_response = review_with_ollama(
                text,
                profile
                or {
                    "name": rules.get(
                        "brand_name",
                        "Inkloom Demo Brand",
                    ),
                    "description": "",
                    "tone_of_voice": "",
                    "preferred_terminology": [],
                    "terms_requiring_review": [],
                    "guidelines": [],
                },
            )

            ai_result = json.loads(
                ai_response
            )

            if not isinstance(
                ai_result,
                dict,
            ):
                raise ValueError(
                    "AI response must be a JSON object."
                )

            if not isinstance(
                ai_result.get(
                    "findings"
                ),
                list,
            ):
                raise ValueError(
                    "AI findings must be a list."
                )

            # -----------------------------------------------------
            # CRITICAL CHANGE:
            #
            # Pass the ACTUAL advertisement text into
            # normalize_ai_findings().
            #
            # This allows the backend to reject hallucinated
            # matched_text values.
            # -----------------------------------------------------

            ai_result["findings"] = (
                normalize_ai_findings(
                    [
                        finding
                        for finding
                        in ai_result[
                            "findings"
                        ]
                        if isinstance(
                            finding,
                            dict,
                        )
                    ],
                    mapping_rules,
                    (
                        profile.get(
                            "preferred_terminology",
                            [],
                        )
                        if profile
                        else []
                    ),
                    text,
                )
            )

            ai_result[
                "human_review_required"
            ] = True

            ai_result[
                "ai_status"
            ] = "available"

        except (
            requests.RequestException,
            ValueError,
            KeyError,
            TypeError,
            json.JSONDecodeError,
        ):
            ai_result = {
                "findings": [],
                "human_review_required": True,
                "ai_status": "unavailable",
            }

        # ---------------------------------------------------------
        # COMBINE RULE + AI FINDINGS
        # ---------------------------------------------------------

        combined = combine_findings(
            rule_result,
            ai_result,
        )

        audit_status = (
            "flagged"
            if combined
            else "no_flags"
        )

        # ---------------------------------------------------------
        # FINAL RESPONSE
        # ---------------------------------------------------------

        return {
            "brand_name": rules.get(
                "brand_name",
                "Inkloom Demo Brand",
            ),
            "brand_guideline": profile,
            "status": audit_status,
            "combined_findings": combined,
            "finding_count": len(combined),
            "rule_based": rule_result,
            "ai_review": ai_result,
            "human_review_required": True,
        }

    except HTTPException:
        raise

    except (
        OSError,
        ValueError,
        KeyError,
        TypeError,
    ) as error:

        raise HTTPException(
            status_code=500,
            detail=f"Audit failed: {error}",
        )


def improve_with_ollama(
    request: AdvertisementImprovementRequest,
    verified_findings: list[ImprovementFindingRequest],
) -> dict:
    """Generate employee-reviewed copy using the existing local Ollama model."""

    profile = (
        request.brand_guideline.model_dump()
        if hasattr(request.brand_guideline, "model_dump")
        else request.brand_guideline.dict()
    )
    findings = [
        finding.model_dump() if hasattr(finding, "model_dump") else finding.dict()
        for finding in verified_findings
    ]
    prompt = f"""
You are an advertisement writing assistant. Suggest edits only for the supplied potential compliance findings.
Use the supplied brand profile as the source of truth. Do not invent brand rules, product facts, evidence, guarantees, or claims.
Keep the original intent and facts, and do not claim that the advertisement is approved.
For every line-by-line suggestion, original_text must be copied exactly from the advertisement.
Return valid JSON only, in this exact structure:
{{
  "suggestions": [
    {{
      "original_text": "exact text from the advertisement",
      "reason": "brief explanation based on the supplied finding",
      "suggested_replacement": "safer replacement wording"
    }}
  ],
  "revised_draft": {{
    "title": "complete revised title",
    "caption": "complete revised caption"
  }}
}}

Brand profile:
{json.dumps(profile, ensure_ascii=False, indent=2)}

Potential findings:
{json.dumps(findings, ensure_ascii=False, indent=2)}

Advertisement title:
{request.title}

Advertisement caption:
{request.caption}
"""
    response = requests.post(
        "http://localhost:11434/api/generate",
        json={
            "model": "llama3:latest",
            "prompt": prompt,
            "stream": False,
            "format": "json",
            "options": {"temperature": 0},
        },
        timeout=120,
    )
    response.raise_for_status()
    result = response.json()
    return json.loads(result["response"])


@app.post("/improve")
def improve_ad(request: AdvertisementImprovementRequest):
    ad_text = f"{request.title}\n{request.caption}".strip()
    findings = [
        finding
        for finding in request.findings
        if matched_text_exists_in_ad(finding.matched_text, ad_text)
    ]
    if not findings:
        logger.warning(
            "Improvement request has no verified findings: matched_texts=%s ad_text_length=%s",
            [finding.matched_text for finding in request.findings],
            len(ad_text),
        )
        raise HTTPException(
            status_code=409,
            detail="No verified findings match the current advertisement. Run the audit again.",
        )

    try:
        result = improve_with_ollama(request, findings)
    except requests.RequestException as error:
        raise HTTPException(
            status_code=503,
            detail="AI service unavailable. Please start Ollama and try again.",
        ) from error
    except (ValueError, KeyError, TypeError) as error:
        raise HTTPException(
            status_code=502,
            detail="AI service returned an invalid improvement response.",
        ) from error

    if not isinstance(result, dict) or not isinstance(result.get("suggestions"), list):
        raise HTTPException(
            status_code=502,
            detail="AI service returned an invalid improvement response.",
        )

    revised_draft = result.get("revised_draft")
    if (
        not isinstance(revised_draft, dict)
        or not isinstance(revised_draft.get("title"), str)
        or not isinstance(revised_draft.get("caption"), str)
        or not revised_draft["title"].strip()
        or not revised_draft["caption"].strip()
    ):
        raise HTTPException(
            status_code=502,
            detail="AI service returned an invalid improvement response.",
        )

    suggestions = []
    finding_texts = [finding.matched_text.casefold() for finding in findings]
    for suggestion in result["suggestions"]:
        if not isinstance(suggestion, dict):
            continue
        original_text = str(suggestion.get("original_text") or "").strip()
        reason = str(suggestion.get("reason") or "").strip()
        replacement = str(suggestion.get("suggested_replacement") or "").strip()
        original_normalized = original_text.casefold()
        relates_to_finding = any(
            original_normalized in finding_text
            or finding_text in original_normalized
            for finding_text in finding_texts
        )
        if (
            original_text
            and reason
            and replacement
            and relates_to_finding
            and matched_text_exists_in_ad(original_text, ad_text)
        ):
            suggestions.append({
                "original_text": original_text,
                "reason": reason,
                "suggested_replacement": replacement,
            })

    if not suggestions:
        raise HTTPException(
            status_code=502,
            detail="AI service did not return verifiable line-by-line suggestions.",
        )

    return {
        "suggestions": suggestions,
        "revised_draft": {
            "title": revised_draft["title"],
            "caption": revised_draft["caption"],
        },
        "human_review_required": True,
    }
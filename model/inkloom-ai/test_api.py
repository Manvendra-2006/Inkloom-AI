import json
import unittest
from unittest.mock import patch

from fastapi import HTTPException

from api import (
    AdvertisementImprovementRequest,
    AdvertisementRequest,
    BrandGuidelineRequest,
    audit_ad,
    build_mapping_rules,
    build_profile_rules,
    combine_findings,
    improve_ad,
    normalize_ai_findings,
    stable_term_guideline_id,
)
from main import audit_advertisement, load_brand_rules


class TestFindingNormalization(unittest.TestCase):
    def setUp(self):
        self.baseline_rules = load_brand_rules()
        self.profile = {
            "name": "OptiForge",
            "description": "AI-powered brand governance and advertisement review",
            "tone_of_voice": "Professional and trustworthy",
            "preferred_terminology": [
                "customers",
                "designed to help",
                "evidence-based",
            ],
            "terms_requiring_review": [
                "guarantees",
                "guaranteed",
                "cheapest",
                "risk-free",
                "100% success",
            ],
            "guidelines": [],
        }

    def test_profile_terms_receive_specific_stable_ids(self):
        rules = build_profile_rules(self.profile, self.baseline_rules)
        ids = {rule["guideline_id"] for rule in rules}

        self.assertIn("CLAIM-001", ids)
        self.assertIn("CLAIM-002", ids)
        self.assertIn(stable_term_guideline_id("risk-free"), ids)
        self.assertTrue(all(
            guideline_id.startswith(("CLAIM-", "TERM-"))
            for guideline_id in ids
        ))
        self.assertEqual(len(ids), len(rules))

    def test_ai_findings_are_mapped_and_preferred_terms_are_not_flags(self):
        findings = [
            {
                "category": "tone",
                "severity": "high",
                "matched_text": "revolutionary platform",
                "reason": "Hype wording may conflict with the brand tone.",
            },
            {
                "category": "claims",
                "severity": "high",
                "matched_text": "guarantees 2X more sales",
                "reason": "The guarantee needs evidence.",
            },
            {
                "category": "comparative claims",
                "severity": "high",
                "matched_text": "cheapest",
                "reason": "The comparative claim needs evidence.",
            },
            {
                "category": "claims",
                "severity": "medium",
                "matched_text": "risk-free",
                "reason": "The term requires review.",
            },
            {
                "category": "terminology",
                "severity": "low",
                "matched_text": "evidence-based",
                "reason": "This is preferred wording.",
            },
            {
                "category": "terminology",
                "severity": "low",
                "matched_text": "made to help customers",
                "reason": "It does not use the preferred terminology 'designed to help'.",
            },
            {
                "category": "tone",
                "severity": "medium",
                "matched_text": "teal",
                "reason": "An issue without a configured guideline.",
            },
        ]

        normalized = normalize_ai_findings(
            findings,
            build_mapping_rules(self.profile, self.baseline_rules),
            self.profile["preferred_terminology"],
            "Our revolutionary platform guarantees 2X more sales and is the cheapest. "
            "This is risk-free, evidence-based, made to help customers, and teal.",
        )
        by_text = {finding["matched_text"]: finding for finding in normalized}

        self.assertEqual(by_text["revolutionary platform"]["guideline_id"], "TONE-001")
        self.assertEqual(by_text["guarantees 2X more sales"]["guideline_id"], "CLAIM-001")
        self.assertEqual(by_text["cheapest"]["guideline_id"], "CLAIM-002")
        self.assertEqual(
            by_text["risk-free"]["guideline_id"],
            stable_term_guideline_id("risk-free"),
        )
        self.assertIsNone(by_text["teal"]["guideline_id"])
        self.assertEqual(by_text["teal"]["mapping_status"], "unmapped")
        self.assertNotIn("evidence-based", by_text)
        self.assertNotIn("made to help customers", by_text)

    def test_rule_and_ai_findings_merge_by_guideline_id(self):
        profile_rules = build_profile_rules(self.profile, self.baseline_rules)
        rule_result = audit_advertisement(
            "Our product guarantees 2X more sales and is the cheapest, risk-free offer.",
            {
                "brand_name": self.profile["name"],
                "terms_requiring_review": profile_rules,
                "human_review_required": True,
            },
        )
        ai_result = {
            "findings": normalize_ai_findings(
                [
                    {
                        "category": "claims",
                        "severity": "high",
                        "matched_text": "guarantees 2X more sales",
                        "reason": "The claim needs evidence.",
                    },
                    {
                        "category": "claims",
                        "severity": "medium",
                        "matched_text": "risk-free",
                        "reason": "The term needs review.",
                    },
                ],
                build_mapping_rules(self.profile, self.baseline_rules),
                self.profile["preferred_terminology"],
                "Our product guarantees 2X more sales and is the cheapest, risk-free offer.",
            )
        }

        combined = combine_findings(rule_result, ai_result)
        guarantee_findings = [
            finding for finding in combined
            if finding["guideline_id"] == "CLAIM-001"
        ]
        risk_findings = [
            finding for finding in combined
            if finding["guideline_id"] == stable_term_guideline_id("risk-free")
        ]

        self.assertEqual(len(guarantee_findings), 1)
        self.assertEqual(guarantee_findings[0]["sources"], ["rule", "ai"])
        self.assertEqual(len(risk_findings), 1)
        self.assertEqual(risk_findings[0]["sources"], ["brand_custom", "ai"])
        self.assertTrue(risk_findings[0]["source_findings"])

    def test_same_guideline_does_not_merge_distinct_wording(self):
        combined = combine_findings(
            {
                "findings": [{
                    "guideline_id": "CLAIM-001",
                    "mapping_status": "mapped",
                    "category": "claims",
                    "severity": "high",
                    "matched_text": "guarantees 2X more sales",
                    "reason": "The claim needs evidence.",
                    "source": "rule",
                }],
            },
            {
                "findings": [{
                    "guideline_id": "CLAIM-001",
                    "mapping_status": "mapped",
                    "category": "claims",
                    "severity": "high",
                    "matched_text": "never guarantee results",
                    "reason": "A separate phrase needs context.",
                    "source": "ai",
                }],
            },
        )

        self.assertEqual(len(combined), 2)

    def test_audit_response_keeps_full_normalized_findings(self):
        profile = BrandGuidelineRequest(**self.profile)
        ai_response = {
            "findings": [
                {
                    "category": "tone",
                    "severity": "high",
                    "matched_text": "revolutionary",
                    "reason": "Hype wording may need review.",
                },
                {
                    "category": "claims",
                    "severity": "high",
                    "matched_text": "guarantees",
                    "reason": "Guarantee wording needs evidence.",
                },
                {
                    "category": "claims",
                    "severity": "medium",
                    "matched_text": "risk-free",
                    "reason": "This term needs review.",
                },
                {
                    "category": "tone",
                    "severity": "low",
                    "matched_text": "teal",
                    "reason": "No configured rule supports this issue.",
                },
            ],
        }

        with patch("api.review_with_ollama", return_value=json.dumps(ai_response)):
            result = audit_ad(AdvertisementRequest(
                text="Our revolutionary product guarantees results and is risk-free.",
                brand_guideline=profile,
            ))

        self.assertEqual(result["finding_count"], len(result["combined_findings"]))
        self.assertIn("rule_based", result)
        self.assertIn("ai_review", result)
        self.assertTrue(result["human_review_required"])
        self.assertEqual(
            {
                field
                for finding in result["combined_findings"]
                for field in (
                    "guideline_id",
                    "source",
                    "mapping_status",
                    "category",
                    "severity",
                    "matched_text",
                    "reason",
                )
                if field in finding
            },
            {
                "guideline_id",
                "source",
                "mapping_status",
                "category",
                "severity",
                "matched_text",
                "reason",
            },
        )
        self.assertEqual(
            next(
                finding for finding in result["combined_findings"]
                if finding["matched_text"] == "revolutionary"
            )["guideline_id"],
            "TONE-001",
        )
        unknown = next(
            finding for finding in result["combined_findings"]
            if finding["matched_text"] == "teal"
        )
        self.assertIsNone(unknown["guideline_id"])
        self.assertEqual(unknown["mapping_status"], "unmapped")


class TestAdvertisementImprovement(unittest.TestCase):
    def test_node_improvement_payload_matches_fastapi_request_model(self):
        request = AdvertisementImprovementRequest(
            title="SmartFit Pro",
            caption="Our product guarantees results.",
            brand_guideline={
                "id": "profile-id",
                "version": "2.0",
                "is_active": True,
                "name": "OptiForge",
                "description": "Fitness technology",
                "tone_of_voice": "Professional and trustworthy",
                "preferred_terminology": ["customers"],
                "terms_requiring_review": ["guarantees"],
                "guidelines": [{
                    "guideline_id": "CLAIM-001",
                    "category": "CLAIMS",
                    "title": "Evidence required",
                    "description": "Review unsupported claims.",
                    "rule": "Do not make guarantees.",
                    "examples": "guarantees results",
                    "severity": "HIGH",
                    "active": True,
                }],
            },
            findings=[{
                "guideline_id": "CLAIM-001",
                "source": "ai",
                "mapping_status": "mapped",
                "category": "claims",
                "severity": "high",
                "matched_text": "guarantees results",
                "reason": "The guarantee needs evidence.",
            }],
        )

        self.assertEqual(request.brand_guideline.guidelines[0].guideline_id, "CLAIM-001")
        self.assertEqual(request.findings[0].matched_text, "guarantees results")

    def test_improvement_returns_both_suggestions_and_revised_draft(self):
        request = AdvertisementImprovementRequest(
            title="SmartFit Pro",
            caption="Our product guarantees 100% success.",
            brand_guideline=BrandGuidelineRequest(
                name="OptiForge",
                description="Fitness technology",
                tone_of_voice="Professional and trustworthy",
            ),
            findings=[{
                "guideline_id": "CLAIM-001",
                "source": "ai",
                "mapping_status": "mapped",
                "category": "claims",
                "severity": "high",
                "matched_text": "guarantees 100% success",
                "reason": "The guarantee needs evidence.",
            }],
        )
        generated = {
            "suggestions": [
                {
                    "original_text": "guaranteed results",
                    "reason": "This wording is not in the advertisement.",
                    "suggested_replacement": "a safer alternative",
                },
                {
                    "original_text": "guarantees 100% success",
                    "reason": "The claim needs approved evidence.",
                    "suggested_replacement": "designed to support your routine",
                },
            ],
            "revised_draft": {
                "title": "SmartFit Pro",
                "caption": "Designed to support your fitness routine.",
            },
        }

        with patch("api.improve_with_ollama", return_value=generated):
            result = improve_ad(request)

        self.assertEqual(result["suggestions"], generated["suggestions"][1:])
        self.assertEqual(result["revised_draft"], generated["revised_draft"])
        self.assertTrue(result["human_review_required"])

    def test_improvement_rejects_unverified_findings_before_generation(self):
        request = AdvertisementImprovementRequest(
            title="SmartFit Pro",
            caption="Designed to support your routine.",
            brand_guideline=BrandGuidelineRequest(
                name="OptiForge",
                description="Fitness technology",
                tone_of_voice="Professional and trustworthy",
            ),
            findings=[{
                "matched_text": "guaranteed",
                "reason": "The wording is under review.",
            }],
        )

        with patch("api.improve_with_ollama") as generate:
            with self.assertRaises(HTTPException):
                improve_ad(request)

        generate.assert_not_called()


if __name__ == "__main__":
    unittest.main(verbosity=2)

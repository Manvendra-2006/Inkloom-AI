import json
import unittest
from unittest.mock import patch

from api import (
    AdvertisementRequest,
    BrandGuidelineRequest,
    audit_ad,
    build_mapping_rules,
    build_profile_rules,
    combine_findings,
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
        self.assertTrue(
            all(
                guideline_id.startswith(("CLAIM-", "TERM-"))
                for guideline_id in ids
            )
        )
        self.assertEqual(len(ids), len(rules))

    def test_ai_findings_are_mapped_and_preferred_terms_are_not_flags(self):
        ad_text = (
            "Our revolutionary platform guarantees 2X more sales, "
            "offers the cheapest plan, and describes its service as risk-free. "
            "It has a teal design, uses evidence-based methods, and is made "
            "to help customers."
        )

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
            ad_text=ad_text,
        )
        by_text = {
            finding["matched_text"]: finding
            for finding in normalized
        }

        self.assertEqual(
            by_text["revolutionary platform"]["guideline_id"],
            "TONE-001",
        )
        self.assertEqual(
            by_text["guarantees 2X more sales"]["guideline_id"],
            "CLAIM-001",
        )
        self.assertEqual(
            by_text["cheapest"]["guideline_id"],
            "CLAIM-002",
        )
        self.assertEqual(
            by_text["risk-free"]["guideline_id"],
            stable_term_guideline_id("risk-free"),
        )
        self.assertIsNone(by_text["teal"]["guideline_id"])
        self.assertEqual(by_text["teal"]["mapping_status"], "unmapped")
        self.assertNotIn("evidence-based", by_text)
        self.assertNotIn("made to help customers", by_text)

    def test_rule_and_ai_findings_merge_by_guideline_id(self):
        profile_rules = build_profile_rules(
            self.profile,
            self.baseline_rules,
        )
        ad_text = (
            "Our product guarantees 2X more sales and is the cheapest, "
            "risk-free offer."
        )

        rule_result = audit_advertisement(
            ad_text,
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
                ad_text=ad_text,
            )
        }

        combined = combine_findings(rule_result, ai_result)

        guarantee_findings = [
            finding
            for finding in combined
            if finding["guideline_id"] == "CLAIM-001"
        ]
        risk_findings = [
            finding
            for finding in combined
            if finding["guideline_id"]
            == stable_term_guideline_id("risk-free")
        ]

        self.assertEqual(len(guarantee_findings), 1)
        self.assertEqual(guarantee_findings[0]["sources"], ["rule", "ai"])
        self.assertEqual(len(risk_findings), 1)
        self.assertEqual(
            risk_findings[0]["sources"],
            ["brand_custom", "ai"],
        )
        self.assertTrue(risk_findings[0]["source_findings"])

    def test_same_guideline_does_not_merge_distinct_wording(self):
        combined = combine_findings(
            {
                "findings": [
                    {
                        "guideline_id": "CLAIM-001",
                        "mapping_status": "mapped",
                        "category": "claims",
                        "severity": "high",
                        "matched_text": "guarantees 2X more sales",
                        "reason": "The claim needs evidence.",
                        "source": "rule",
                    }
                ],
            },
            {
                "findings": [
                    {
                        "guideline_id": "CLAIM-001",
                        "mapping_status": "mapped",
                        "category": "claims",
                        "severity": "high",
                        "matched_text": "never guarantee results",
                        "reason": "A separate phrase needs context.",
                        "source": "ai",
                    }
                ],
            },
        )

        self.assertEqual(len(combined), 2)

        def test_audit_response_keeps_rule_findings_and_local_signal(self):
            profile = BrandGuidelineRequest(**self.profile)
            ad_text = (
                "Our revolutionary product guarantees results and is "
                "risk-free, with a teal design."
            )
            model_signal = {
                "label": "REVIEW_CONTEXT",
                "confidence": 0.80,
                "source": "local_ml",
                "status": "available",
                "human_review_required": True,
                "note": "Experimental model signal.",
            }

            with patch("api.run_local_classifier", return_value=model_signal) as classifier:
                result = audit_ad(
                    AdvertisementRequest(
                        text=ad_text,
                        brand_guideline=profile,
                    )
                )

            classifier.assert_called_once_with(ad_text)

            self.assertEqual(
                result["finding_count"],
                len(result["combined_findings"]),
            )
            self.assertIn("rule_based", result)
            self.assertIn("ai_review", result)
            self.assertTrue(result["human_review_required"])

            
            self.assertEqual(result["ai_review"]["findings"], [])
            self.assertEqual(result["ai_review"]["ai_status"], "local_model")
            self.assertEqual(result["model_signal"], model_signal)

            expected_fields = {
                "guideline_id",
                "source",
                "mapping_status",
                "category",
                "severity",
                "matched_text",
                "reason",
            }
            actual_fields = {
                field
                for finding in result["combined_findings"]
                for field in expected_fields
                if field in finding
            }
            self.assertEqual(actual_fields, expected_fields)

         
            guarantee = next(
                finding
                for finding in result["combined_findings"]
                if finding["matched_text"] == "guarantees"
            )
            self.assertEqual(guarantee["guideline_id"], "CLAIM-001")
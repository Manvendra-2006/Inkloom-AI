
import unittest

from main import audit_advertisement, load_brand_rules


class TestAdvertisementAudit(unittest.TestCase):

    def setUp(self):
        self.rules = load_brand_rules()

    def test_detects_guarantees(self):
        result = audit_advertisement(
            "Our product guarantees amazing results.",
            self.rules
        )
        self.assertEqual(result["status"], "flagged")
        self.assertTrue(
            any(
                finding["guideline_id"] == "CLAIM-001"
                for finding in result["findings"]
            )
        )

    def test_detects_cheapest(self):
        result = audit_advertisement(
            "We are the cheapest option.",
            self.rules
        )
        self.assertTrue(
            any(
                finding["guideline_id"] == "CLAIM-002"
                for finding in result["findings"]
            )
        )

    def test_detects_revolutionary(self):
        result = audit_advertisement(
            "Our revolutionary new product.",
            self.rules
        )
        self.assertTrue(
            any(
                finding["guideline_id"] == "TONE-001"
                for finding in result["findings"]
            )
        )

    def test_clean_ad_has_no_flags(self):
        result = audit_advertisement(
            "Explore our product and learn how it works.",
            self.rules
        )
        self.assertEqual(result["status"], "no_flags")
        self.assertEqual(result["findings"], [])

    def test_human_review_is_required(self):
        result = audit_advertisement(
            "A simple product description.",
            self.rules
        )
        self.assertTrue(result["human_review_required"])

    def test_reports_exact_matched_text(self):
        result = audit_advertisement(
            "Our product GUARANTEES amazing results.",
            self.rules
        )
        guarantee_finding = next(
            finding for finding in result["findings"]
            if finding["guideline_id"] == "CLAIM-001"
        )
        self.assertEqual(guarantee_finding["matched_text"], "GUARANTEES")

    def test_matching_is_case_insensitive(self):
        result = audit_advertisement(
            "This product is REVOLUTIONARY.",
            self.rules
        )
        self.assertTrue(
            any(
                finding["guideline_id"] == "TONE-001"
                for finding in result["findings"]
            )
        )

    def test_does_not_match_term_inside_longer_word(self):
        result = audit_advertisement(
            "Our product is not the cheapestness of anything.",
            self.rules
        )
        self.assertFalse(
            any(
                finding["guideline_id"] == "CLAIM-002"
                for finding in result["findings"]
            )
        )
    
    def test_negated_guarantee_is_not_flagged(self):
        result = audit_advertisement(
            "We cannot guarantee results.",
            load_brand_rules()
        )

        guarantee_findings = [
            finding for finding in result["findings"]
            if finding["guideline_id"] == "CLAIM-001"
        ]

        self.assertEqual(guarantee_findings, [])


    def test_positive_guarantee_is_still_flagged(self):
        result = audit_advertisement(
            "We guarantee excellent results.",
            load_brand_rules()
        )

        guarantee_findings = [
            finding for finding in result["findings"]
            if finding["guideline_id"] == "CLAIM-001"
        ]

        self.assertEqual(len(guarantee_findings), 1)

    def test_negated_guarantee_is_not_flagged(self):
        result = audit_advertisement(
            "We cannot guarantee results.",
            load_brand_rules()
        )
        self.assertFalse(
            any(f["guideline_id"] == "CLAIM-001"
                for f in result["findings"])
        )


    def test_guarantee_after_sentence_boundary_is_flagged(self):
        result = audit_advertisement(
            "We do not make unsupported claims. Our product guarantees results.",
            load_brand_rules()
        )
        self.assertTrue(
            any(f["guideline_id"] == "CLAIM-001"
                for f in result["findings"])
        )


    def test_comparative_claim_is_flagged(self):
        result = audit_advertisement(
            "We are the cheapest solution.",
            load_brand_rules()
        )
        self.assertTrue(
            any(f["guideline_id"] == "CLAIM-002"
                for f in result["findings"])
        )



if __name__ == "__main__":
    unittest.main(verbosity=2)

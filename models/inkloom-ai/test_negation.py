import pytest
from main import is_negated


@pytest.mark.parametrize(
    "text, phrase",
    [
        ("We do not offer a guarantee.", "guarantee"),
        ("We do not guarantee results.", "guarantee"),
        ("We don't guarantee results.", "guarantee"),
        ("We cannot guarantee results.", "guarantee"),
        ("We never make a guarantee.", "guarantee"),
        ("Our service is not guaranteed to increase sales.", "guaranteed"),
        ("The product is offered without a guarantee.", "guarantee"),
        ("There is no guarantee of results.", "guarantee"),
    ],
)
def test_negated_guarantee_is_ignored(text, phrase):
    match_start = text.lower().index(phrase)
    assert is_negated(text, match_start)


def test_positive_guarantee_is_not_ignored():
    text = "We guarantee results."
    match_start = text.lower().index("guarantee")
    assert not is_negated(text, match_start)


def test_later_positive_claim_is_not_hidden_by_earlier_negation():
    text = "We do not guarantee results, but we guarantee savings."
    match_start = text.lower().rindex("guarantee")
    assert not is_negated(text, match_start)
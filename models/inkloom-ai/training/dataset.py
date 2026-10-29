import json
import random
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
JSONL_PATH = DATA_DIR / "inkloom_dataset.jsonl"
TEXT_PATH = DATA_DIR / "inkloom_training.txt"

EXAMPLES = {
    "FLAG": [
        "Our product guarantees twice as many sales in 30 days.",
        "Guaranteed to eliminate every security threat from your business.",
        "Get guaranteed results with zero risk.",
        "We promise every customer will double their revenue.",
        "Our tool is the cheapest solution on the market.",
        "Number one in the industry, guaranteed.",
        "Everyone will achieve 100% success with our service.",
        "Double your sales in just seven days, guaranteed.",
        "This is the best product available anywhere.",
        "Risk-free growth with guaranteed profits.",
        "Every team will save exactly ten hours each week.",
        "The only solution that always delivers perfect results.",
        "Guaranteed to outperform every competitor.",
        "Get unlimited results with absolutely no risk.",
        "Our service guarantees a 50% increase in conversions.",
        "The world's cheapest and most effective platform.",
        "You cannot fail when you use our product.",
        "We guarantee instant success for every customer.",
        "Our product always beats every alternative.",
        "Make your business profitable overnight.",
        "Guaranteed to cut costs by 90% for all users."
        "Guaranteed to double your income in seven days.",
        "Every customer will achieve perfect results.",
        "100% success is guaranteed for all users.",
        "Our supplement cures diabetes permanently.",
        "Lose 15 kg in one week without changing your diet.",
        "This investment cannot lose money.",
        "The safest product on the market, with zero risk.",
        "Get instant approval with no conditions whatsoever.",
        "Our treatment works for every patient.",
        "The number one solution worldwide, guaranteed.",
        "Earn $10,000 every month with no experience.",
        "This product eliminates all health problems.",
        "We guarantee you will never have another failure.",
        "Save 90% on every purchase, no exceptions.",
        "The cheapest service available anywhere, guaranteed.",
        "Become fluent in any language in three days.",
        "Our software prevents every possible security breach.",
        "All users will see results within 24 hours.",
        "Double your sales overnight, guaranteed.",
        "Risk-free returns are assured on every investment.",
    ],
    "NO_FLAG": [
        "Keep your team's campaign tasks organized in one workspace.",
        "Create a checklist for your next marketing project.",
        "Plan posts and review drafts with your team.",
        "Manage campaign notes from a shared workspace.",
        "Explore tools for organizing everyday content work.",
        "Coordinate campaign tasks with a shared calendar.",
        "Review marketing drafts before sharing them.",
        "Keep project updates in one place.",
        "Use the workspace to plan upcoming campaigns.",
        "Organize creative assets for easier access.",
        "Track the status of your team's content drafts.",
        "Create and update campaign briefs collaboratively.",
        "Find your team's notes and drafts in one workspace.",
        "Prepare content for review before publication.",
        "Explore a simpler way to coordinate marketing projects.",
        "Share campaign plans with your colleagues.",
        "Group content tasks by project or deadline.",
        "Maintain a list of upcoming campaign activities.",
        "Use a shared workspace for content planning.",
        "Organize your marketing workflow around your team's needs.",
        "Explore practical ways to organize your team's content.",
        "Our workspace helps teams plan and review campaigns.",
        "Learn how to create a clearer content workflow.",
        "Discover tools for managing everyday marketing tasks.",
        "Organize campaign drafts in one shared workspace.",
        "Help your team keep content projects on track.",
        "Try our workspace to manage campaign notes.",
        "Create, review, and organize content in one place.",
        "A simple way to keep marketing materials organized.",
        "Bring your team's campaign tasks into one workspace.",
        "Plan upcoming posts with a shared content calendar.",
        "Review drafts before sending them to your team.",
        "Keep campaign information together for easier access.",
        "Make your content workflow easier to follow.",
        "Explore features designed to support team collaboration.",
        "Use a shared space to coordinate marketing work.",
        "Create a checklist for your next campaign.",
        "Keep track of content drafts and review status.",
        "Find a more organized way to manage projects.",
        "See how the workspace fits your team's process.",
    ],
    "REVIEW_CONTEXT": [
        "Our customers reported a 25% improvement in workflow speed.",
        "Save up to five hours per week with our platform.",
        "Independent testing found improved campaign turnaround time.",
        "Users achieved better results in a recent customer survey.",
        "Our platform is faster than the previous version.",
        "A study found that some teams completed tasks more quickly.",
        "Reduce costs by up to 20%, subject to usage and conditions.",
        "Customers may see improved productivity after onboarding.",
        "Our tool increased engagement in a limited pilot study.",
        "The new workflow was rated easier by surveyed users.",
        "Results vary depending on team size and implementation.",
        "A customer case study reported higher conversion rates.",
        "Our platform can help reduce repetitive work for some teams.",
        "A recent benchmark showed shorter processing times.",
        "The campaign performed better during one test period.",
        "Up to 30% faster reviews were reported in a small trial.",
        "Survey participants said the process felt more efficient.",
        "Our tool improved completion rates in a controlled test.",
        "A comparison showed better results under specific conditions.",
        "A pilot program reported lower average task completion time.",
        "Our product may improve results depending on the customer's workflow.",
        "Results vary by customer, industry, and implementation.",
        "Can we substantiate the claim that customers save 40% of their time?",
        "The campaign says users see results within seven days; evidence is needed.",
        "Does the claim apply to every plan or only selected subscriptions?",
        "The advertised discount may exclude certain products.",
        "The comparison with competitors needs a clear methodology.",
        "The claim references a customer study but provides no source.",
        "Check whether the quoted testimonial has permission for advertising use.",
        "The product is described as suitable for all businesses; clarify the scope.",
        "The ad mentions a limited-time offer without stating the end date.",
        "Verify the conditions attached to the advertised free trial.",
        "The savings claim may depend on usage and subscription tier.",
        "The campaign references clinical results that need appropriate substantiation.",
        "Confirm the geographic availability of the advertised service.",
        "The price comparison needs matching product specifications and dates.",
        "The ad says setup takes minutes; confirm the conditions for that estimate.",
        "Check whether the performance statistic reflects a representative sample.",
        "The guarantee may have exclusions that should be stated clearly.",
        "The headline implies a typical outcome, but the evidence is unclear.",
    ],
}


def main():
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    rows = [
        {"text": text, "label": label}
        for label, examples in EXAMPLES.items()
        for text in examples
    ]

    random.Random(42).shuffle(rows)

    with JSONL_PATH.open("w", encoding="utf-8") as file:
        for row in rows:
            file.write(json.dumps(row, ensure_ascii=False) + "\n")


    with TEXT_PATH.open("w", encoding="utf-8") as file:
        for row in rows:
            file.write(f"Label: {row['label']}\n")
            file.write(f"Text: {row['text']}\n\n")

    print(f"Created {len(rows)} synthetic examples.")
    for label in EXAMPLES:
        print(f"{label}: {len(EXAMPLES[label])} examples")
    print(f"Structured dataset: {JSONL_PATH}")
    print(f"Character-model corpus: {TEXT_PATH}")
    print("Synthetic data only; model predictions need independent evaluation.")


if __name__ == "__main__":
    main()
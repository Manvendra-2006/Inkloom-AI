from pathlib import Path
import re
import torch
import torch.nn as nn

ROOT = Path(__file__).resolve().parent
CHECKPOINT = ROOT / "checkpoints" / "inkloom_classifier.pt"

LABELS = ["FLAG", "NO_FLAG", "REVIEW_CONTEXT"]
MAX_LEN = 40
EMBED_DIM = 48


def tokenize(text):
    return re.findall(r"[a-z0-9]+|[^\w\s]", text.lower())


class InkloomClassifier(nn.Module):
    def __init__(self, vocab_size):
        super().__init__()
        self.embedding = nn.Embedding(vocab_size, EMBED_DIM, padding_idx=0)
        self.network = nn.Sequential(
            nn.Linear(EMBED_DIM, 64),
            nn.ReLU(),
            nn.Dropout(0.1),
            nn.Linear(64, len(LABELS)),
        )

    def forward(self, token_ids, mask):
        embeddings = self.embedding(token_ids)
        mask = mask.unsqueeze(-1)
        pooled = (embeddings * mask).sum(dim=1)
        pooled = pooled / mask.sum(dim=1).clamp(min=1)
        return self.network(pooled)


checkpoint = torch.load(CHECKPOINT, map_location="cpu", weights_only=True)
vocab = checkpoint["vocab"]
model = InkloomClassifier(len(vocab))
model.load_state_dict(checkpoint["model_state"])
model.eval()


def predict(text):
    tokens = tokenize(text)[:MAX_LEN]
    ids = [vocab.get(token, vocab["<UNK>"]) for token in tokens]
    mask = [1] * len(ids)

    while len(ids) < MAX_LEN:
        ids.append(vocab["<PAD>"])
        mask.append(0)

    x = torch.tensor([ids], dtype=torch.long)
    m = torch.tensor([mask], dtype=torch.float32)

    with torch.no_grad():
        probabilities = torch.softmax(model(x, m), dim=1)[0]

    best = int(probabilities.argmax())
    return LABELS[best], float(probabilities[best])


if __name__ == "__main__":
    print("Inkloom experimental classifier")
    print("Type 'quit' to exit.")

    while True:
        text = input("\nAdvertisement: ").strip()

        if text.lower() in {"quit", "exit"}:
            break

        if not text:
            continue

        label, confidence = predict(text)
        print(f"Prediction: {label} ({confidence:.1%} model confidence)")
        print("Experimental only — verify with the rule-based audit and human review.")
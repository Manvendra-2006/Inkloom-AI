from pathlib import Path
import json
import random
import re
from collections import Counter

import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset

SEED = 42
random.seed(SEED)
torch.manual_seed(SEED)
torch.set_num_threads(4)

ROOT = Path(__file__).resolve().parent
DATA_FILE = ROOT / "data" / "inkloom_dataset.jsonl"
CHECKPOINT_DIR = ROOT / "checkpoints"
CHECKPOINT_DIR.mkdir(parents=True, exist_ok=True)

LABELS = ["FLAG", "NO_FLAG", "REVIEW_CONTEXT"]
label_to_id = {label: i for i, label in enumerate(LABELS)}

MAX_LEN = 40
EMBED_DIM = 48
EPOCHS = 100
BATCH_SIZE = 8
TRAIN_RATIO = 0.8


def tokenize(text):
    return re.findall(r"[a-z0-9]+|[^\w\s]", text.lower())


if not DATA_FILE.exists():
    raise FileNotFoundError(f"Dataset not found: {DATA_FILE}")

examples = []
with DATA_FILE.open("r", encoding="utf-8") as f:
    for line in f:
        if not line.strip():
            continue
        item = json.loads(line)
        if item.get("label") not in label_to_id:
            raise ValueError(f"Unknown label: {item.get('label')}")
        if not isinstance(item.get("text"), str) or not item["text"].strip():
            raise ValueError("Each example must contain non-empty text.")
        examples.append(item)

if len(examples) < 15:
    raise ValueError("Add more labeled examples before training.")

print(f"Total examples: {len(examples)}")
print("Full dataset label counts:", dict(Counter(x["label"] for x in examples)))

rng = random.Random(SEED)
train_examples = []
val_examples = []

for label in LABELS:
    group = [x for x in examples if x["label"] == label]
    rng.shuffle(group)

    if len(group) < 2:
        raise ValueError(
            f"Need at least 2 examples for label {label}; found {len(group)}."
        )

    cut = max(1, min(len(group) - 1, int(len(group) * TRAIN_RATIO)))
    train_examples.extend(group[:cut])
    val_examples.extend(group[cut:])

rng.shuffle(train_examples)
rng.shuffle(val_examples)

print(f"Training examples: {len(train_examples)}")
print("Training label counts:", dict(Counter(x["label"] for x in train_examples)))
print(f"Validation examples: {len(val_examples)}")
print("Validation label counts:", dict(Counter(x["label"] for x in val_examples)))


vocab = {"<PAD>": 0, "<UNK>": 1}
for item in train_examples:
    for token in tokenize(item["text"]):
        if token not in vocab:
            vocab[token] = len(vocab)


def encode(text):
    tokens = tokenize(text)[:MAX_LEN]
    ids = [vocab.get(token, vocab["<UNK>"]) for token in tokens]
    mask = [1] * len(ids)

    while len(ids) < MAX_LEN:
        ids.append(vocab["<PAD>"])
        mask.append(0)

    return ids, mask


def make_tensors(rows):
    encoded = [encode(item["text"]) for item in rows]
    x = torch.tensor([item[0] for item in encoded], dtype=torch.long)
    mask = torch.tensor([item[1] for item in encoded], dtype=torch.float32)
    y = torch.tensor(
        [label_to_id[item["label"]] for item in rows],
        dtype=torch.long,
    )
    return x, mask, y


X_train, M_train, Y_train = make_tensors(train_examples)
X_val, M_val, Y_val = make_tensors(val_examples)

train_loader = DataLoader(
    TensorDataset(X_train, M_train, Y_train),
    batch_size=BATCH_SIZE,
    shuffle=True,
)


class InkloomClassifier(nn.Module):
    def __init__(self, vocab_size):
        super().__init__()
        self.embedding = nn.Embedding(
            vocab_size, EMBED_DIM, padding_idx=0
        )
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


model = InkloomClassifier(len(vocab))
optimizer = torch.optim.AdamW(model.parameters(), lr=0.005)
loss_fn = nn.CrossEntropyLoss()

print(f"Vocabulary: {len(vocab)} tokens")
print(f"Model parameters: {sum(p.numel() for p in model.parameters()):,}")
print("Training classifier from random initialization...")

for epoch in range(1, EPOCHS + 1):
    model.train()
    total_loss = 0.0

    for batch_x, batch_mask, batch_y in train_loader:
        logits = model(batch_x, batch_mask)
        loss = loss_fn(logits, batch_y)

        optimizer.zero_grad()
        loss.backward()
        optimizer.step()
        total_loss += loss.item()

    if epoch == 1 or epoch % 10 == 0:
        print(
            f"Epoch {epoch:3d}/{EPOCHS} | "
            f"training loss: {total_loss / len(train_loader):.4f}"
        )


model.eval()
with torch.no_grad():
    logits = model(X_val, M_val)
    predictions = logits.argmax(dim=1).tolist()

actual = Y_val.tolist()
correct = sum(p == y for p, y in zip(predictions, actual))
accuracy = correct / len(actual)

print("\n=== Validation results ===")
print(f"Accuracy: {accuracy:.1%}")
print("Note: the validation set is small, so scores can vary considerably.")


print("\nPer-class metrics:")
for class_id, label in enumerate(LABELS):
    tp = sum(p == class_id and y == class_id
             for p, y in zip(predictions, actual))
    fp = sum(p == class_id and y != class_id
             for p, y in zip(predictions, actual))
    fn = sum(p != class_id and y == class_id
             for p, y in zip(predictions, actual))

    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    f1 = (
        2 * precision * recall / (precision + recall)
        if precision + recall else 0.0
    )
    support = sum(y == class_id for y in actual)

    print(
        f"{label:16} precision={precision:.2f} "
        f"recall={recall:.2f} F1={f1:.2f} support={support}"
    )

print("\nConfusion matrix (rows=actual, columns=predicted):")
print("Actual\\Pred  " + "  ".join(LABELS))
for actual_id, actual_label in enumerate(LABELS):
    counts = [
        sum(y == actual_id and p == pred_id
            for y, p in zip(actual, predictions))
        for pred_id in range(len(LABELS))
    ]
    print(f"{actual_label:16} " + "  ".join(map(str, counts)))


save_path = CHECKPOINT_DIR / "inkloom_classifier.pt"
torch.save(
    {
        "model_state": model.state_dict(),
        "vocab": vocab,
        "labels": LABELS,
        "max_len": MAX_LEN,
        "embed_dim": EMBED_DIM,
    },
    save_path,
)

print(f"\nSaved classifier to: {save_path}")
print("Experimental only; do not use model predictions as final compliance decisions.")
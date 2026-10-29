from pathlib import Path
import json
import torch
import torch.nn as nn
import torch.nn.functional as F


torch.manual_seed(42)
torch.set_num_threads(4)

ROOT = Path(__file__).resolve().parent
DATA_FILE = ROOT / "data" / "inkloom_training.txt"
CHECKPOINT_DIR = ROOT / "checkpoints"
CHECKPOINT_DIR.mkdir(parents=True, exist_ok=True)


text = DATA_FILE.read_text(encoding="utf-8")
if len(text) < 200:
    raise ValueError("Training text is too small. Add more examples first.")

vocab = sorted(set(text))
stoi = {ch: i for i, ch in enumerate(vocab)}
itos = {i: ch for ch, i in stoi.items()}
data = torch.tensor([stoi[ch] for ch in text], dtype=torch.long)

split = int(0.9 * len(data))
train_data = data[:split]
val_data = data[split:]


BLOCK_SIZE = 64
BATCH_SIZE = 16
STEPS = 300
EVAL_EVERY = 50
EMBED_DIM = 64
HEADS = 4
LAYERS = 2
LEARNING_RATE = 0.001


def get_batch(source):
    starts = torch.randint(
        0, len(source) - BLOCK_SIZE - 1, (BATCH_SIZE,)
    )
    x = torch.stack([source[i:i + BLOCK_SIZE] for i in starts])
    y = torch.stack([source[i + 1:i + BLOCK_SIZE + 1] for i in starts])
    return x, y


class TinyLanguageModel(nn.Module):
    def __init__(self):
        super().__init__()
        self.token_embedding = nn.Embedding(len(vocab), EMBED_DIM)
        self.position_embedding = nn.Embedding(BLOCK_SIZE, EMBED_DIM)

        layer = nn.TransformerEncoderLayer(
            d_model=EMBED_DIM,
            nhead=HEADS,
            dim_feedforward=EMBED_DIM * 2,
            dropout=0.0,
            batch_first=True,
        )
        self.transformer = nn.TransformerEncoder(layer, num_layers=LAYERS)
        self.norm = nn.LayerNorm(EMBED_DIM)
        self.output = nn.Linear(EMBED_DIM, len(vocab))

    def forward(self, x, targets=None):
        batch, length = x.shape
        positions = torch.arange(length, device=x.device)
        h = self.token_embedding(x) + self.position_embedding(positions)

        mask = torch.triu(
            torch.full((length, length), float("-inf")),
            diagonal=1,
        ).to(x.device)

        h = self.transformer(h, mask=mask)
        logits = self.output(self.norm(h))

        loss = None
        if targets is not None:
            loss = F.cross_entropy(
                logits.reshape(-1, len(vocab)),
                targets.reshape(-1),
            )
        return logits, loss

    @torch.no_grad()
    def generate(self, prompt, max_new_chars=250):
        self.eval()
        prompt = prompt or "\n"
        ids = [stoi.get(ch, 0) for ch in prompt]
        x = torch.tensor([ids], dtype=torch.long)

        for _ in range(max_new_chars):
            x_context = x[:, -BLOCK_SIZE:]
            logits, _ = self(x_context)
            probabilities = torch.softmax(logits[:, -1, :], dim=-1)
            next_id = torch.multinomial(probabilities, num_samples=1)
            x = torch.cat([x, next_id], dim=1)

        result = "".join(itos[int(i)] for i in x[0])
        self.train()
        return result


model = TinyLanguageModel()
optimizer = torch.optim.AdamW(model.parameters(), lr=LEARNING_RATE)

print(f"Training characters: {len(train_data)}")
print(f"Vocabulary size: {len(vocab)}")
print(f"Model parameters: {sum(p.numel() for p in model.parameters()):,}")
print("Training from random initialization on CPU...")

for step in range(1, STEPS + 1):
    model.train()
    x, y = get_batch(train_data)
    _, loss = model(x, y)

    optimizer.zero_grad(set_to_none=True)
    loss.backward()
    torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
    optimizer.step()

    if step % EVAL_EVERY == 0 or step == 1:
        model.eval()
        with torch.no_grad():
            vx, vy = get_batch(val_data)
            _, val_loss = model(vx, vy)
        print(
            f"Step {step:3d}/{STEPS} | "
            f"train loss: {loss.item():.3f} | "
            f"validation loss: {val_loss.item():.3f}"
        )

checkpoint = {
    "model_state": model.state_dict(),
    "stoi": stoi,
    "itos": itos,
    "config": {
        "block_size": BLOCK_SIZE,
        "embed_dim": EMBED_DIM,
        "heads": HEADS,
        "layers": LAYERS,
        "vocab_size": len(vocab),
    },
}
save_path = CHECKPOINT_DIR / "inkloom_tiny_model.pt"
torch.save(checkpoint, save_path)

print(f"\nSaved model to: {save_path}")
print("\nSample generated text:")
print(model.generate("Advertisement:", max_new_chars=250))
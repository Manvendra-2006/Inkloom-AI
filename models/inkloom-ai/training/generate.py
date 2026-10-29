from pathlib import Path
import torch
import torch.nn as nn
import torch.nn.functional as F

ROOT = Path(__file__).resolve().parent
CHECKPOINT = ROOT / "checkpoints" / "inkloom_tiny_model.pt"

if not CHECKPOINT.exists():
    raise FileNotFoundError(
        f"Checkpoint not found: {CHECKPOINT}\nRun python training\\train.py first."
    )


checkpoint = torch.load(CHECKPOINT, map_location="cpu", weights_only=True)
stoi = checkpoint["stoi"]
itos = {int(k): v for k, v in checkpoint["itos"].items()}
config = checkpoint["config"]

BLOCK_SIZE = config["block_size"]
EMBED_DIM = config["embed_dim"]
HEADS = config["heads"]
LAYERS = config["layers"]
VOCAB_SIZE = config["vocab_size"]


class TinyLanguageModel(nn.Module):
    def __init__(self):
        super().__init__()
        self.token_embedding = nn.Embedding(VOCAB_SIZE, EMBED_DIM)
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
        self.output = nn.Linear(EMBED_DIM, VOCAB_SIZE)

    def forward(self, x):
        length = x.shape[1]
        positions = torch.arange(length, device=x.device)
        h = self.token_embedding(x) + self.position_embedding(positions)

        mask = torch.triu(
            torch.full((length, length), float("-inf")),
            diagonal=1,
        ).to(x.device)

        h = self.transformer(h, mask=mask)
        return self.output(self.norm(h))

    @torch.no_grad()
    def generate(self, prompt, max_new_chars=250):
        ids = [stoi.get(ch, 0) for ch in (prompt or "\n")]
        x = torch.tensor([ids], dtype=torch.long)

        for _ in range(max_new_chars):
            context = x[:, -BLOCK_SIZE:]
            logits = self(context)
            probs = torch.softmax(logits[:, -1, :], dim=-1)
            next_id = torch.multinomial(probs, num_samples=1)
            x = torch.cat([x, next_id], dim=1)

        return "".join(itos[int(i)] for i in x[0])


model = TinyLanguageModel()
model.load_state_dict(checkpoint["model_state"])
model.eval()

print("Loaded Inkloom's tiny model from:", CHECKPOINT)
print("\nGenerated sample:\n")
print(model.generate("Advertisement:", max_new_chars=250))
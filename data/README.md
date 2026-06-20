# Collected data (`data/`)

Staging area for **machine/agent-collected** dark-pattern examples, kept separate from the
clean evaluation set in [`eval/dataset.jsonl`](../eval/dataset.jsonl).

> **Why separate?** `eval/dataset.jsonl` is a held-out yardstick. If you train on collected
> data, never let it leak into eval, and never measure on data you trained on. Collect here,
> then **curate + split** into train/test deliberately.

## Format — `collected.jsonl`

One JSON object per line (JSONL). Required keys `text` and `label`; the rest are provenance.

```json
{
  "text": "To cancel, you must call us Mon–Fri 9–5",
  "label": "Obstruction",
  "source": "https://www.deceptive.design/types/obstruction",
  "notes": "cancellation friction"
}
```

| Field    | Required    | Notes                                                                               |
| -------- | ----------- | ----------------------------------------------------------------------------------- |
| `text`   | ✅          | Short, realistic UI snippet (≈10–300 chars), English. As it would appear on a page. |
| `label`  | ✅          | Exactly one of the 8 class strings (see [taxonomy](LABELING_GUIDE.md)).             |
| `source` | recommended | URL the example/phrasing came from (provenance).                                    |
| `notes`  | optional    | Why it fits the class.                                                              |

The training/eval loaders only read `text` + `label`; extra keys are ignored, so provenance
is safe to keep.

## Labeling

See [`LABELING_GUIDE.md`](LABELING_GUIDE.md) for precise class definitions and trusted sources.
The current model is weakest on **Forced Action, Obstruction, Sneaking** — prioritize those.

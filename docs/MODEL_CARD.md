# Model Card — DigiCom DistilBERT (dark-pattern classifier)

A compact, on-device text classifier that labels short snippets of web UI text with the type
of dark pattern they represent (or "Not Dark Pattern"). It powers **Stage 2** of DigiCom's
hybrid detection pipeline; **Stage 1** is a set of regex heuristics in
[`extension/detection.js`](../extension/detection.js).

> ⚠️ **Read the [Limitations](#limitations) first.** On the current evaluation set the model
> reliably detects Scarcity, Social Proof, Urgency and Misdirection, but **fails to detect
> Forced Action, Obstruction and Sneaking** (it classifies them as "Not Dark Pattern"). These
> metrics are from a small curated set and should not be read as production guarantees.

## Model details

|                     |                                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------ |
| Architecture        | DistilBERT (`DistilBertForSequenceClassification`) — 6 layers, hidden dim 768, 12 heads                      |
| Task                | Single-label sequence classification, 8 classes                                                              |
| Max sequence length | 512 tokens                                                                                                   |
| Vocab               | 30,522 (WordPiece, uncased)                                                                                  |
| Format              | ONNX, **quantized to `q8`** (`model_quantized.onnx`, ≈ 67 MB)                                                |
| Runtime             | [Transformers.js](https://github.com/huggingface/transformers.js) + ONNX Runtime Web (WASM), single-threaded |
| Exported with       | transformers 4.57.6                                                                                          |
| Location            | [`extension/models/dpbh-distilbert/`](../extension/models/dpbh-distilbert/)                                  |

### Classes

`Forced Action`, `Misdirection`, `Not Dark Pattern`, `Obstruction`, `Scarcity`, `Sneaking`,
`Social Proof`, `Urgency`. `Not Dark Pattern` is the negative class and is never highlighted
in the UI. Severity mapping (UI only) lives in `SEVERITY_MAP` in `detection.js`.

## Intended use

- **Primary:** flag manipulative UI text on e-commerce / shopping pages in real time, on the
  user's device, to help shoppers recognize manipulation. Consumer-protection aligned (e.g.
  India's CCPA _Guidelines for Prevention and Regulation of Dark Patterns, 2023_).
- **Users:** shoppers (via the extension); researchers/developers studying dark patterns.

### Out of scope

- Not legal advice and not a compliance/certification tool.
- Not a complete detector — absence of a highlight does **not** mean a page is manipulation-free.
- Trained/evaluated on **English** text; other languages are unsupported.
- Operates on short snippets; long-form documents are filtered out before classification.

## Training data

**Unknown / not reproducible from this repository.** The repo ships only the exported model
artifact — there are no training scripts, data, or logs. The label set matches an 8-class
dark-pattern taxonomy consistent with public work such as Mathur et al. (2019), "Dark
Patterns at Scale." If you retrain, document the dataset, splits, and procedure here and add
a training script to the repo.

## Evaluation

### How it was measured

Run on the curated, hand-labeled set in [`eval/dataset.jsonl`](../eval/dataset.jsonl) using
the **same model and `q8` dtype the extension loads**, via
[`scripts/evaluate.mjs`](../scripts/evaluate.mjs):

```bash
npm run eval        # prints the report, writes eval/results.json
```

> ⚠️ **This is a small smoke/sanity set (71 examples, ~6–12 per class), authored to exercise
> each category — not a held-out random sample of real pages.** Treat the numbers as a
> directional health check, not a production benchmark. Expand `eval/dataset.jsonl` with
> real-world, independently-labeled snippets before making any accuracy claims.

### Results (71 examples, 8 classes)

| Metric          | Value     |
| --------------- | --------- |
| Accuracy        | **53.5%** |
| Macro F1        | **44.5%** |
| Weighted F1     | **45.7%** |
| Macro precision | 40.8%     |
| Macro recall    | 51.0%     |

Per-class:

| Class            | Precision | Recall |    F1 | Support |
| ---------------- | --------: | -----: | ----: | ------: |
| Forced Action    |      0.0% |   0.0% |  0.0% |      10 |
| Misdirection     |     66.7% |  66.7% | 66.7% |       9 |
| Not Dark Pattern |     30.0% |  75.0% | 42.9% |      12 |
| Obstruction      |      0.0% |   0.0% |  0.0% |       6 |
| Scarcity         |     80.0% |  88.9% | 84.2% |       9 |
| Sneaking         |      0.0% |   0.0% |  0.0% |       8 |
| Social Proof     |     80.0% | 100.0% | 88.9% |       8 |
| Urgency          |     70.0% |  77.8% | 73.7% |       9 |

Confusion matrix (rows = true label, columns = predicted):

```
                   Forc Misd Not  Obst Scar Snea Soci Urge
Forced Action         0    2    8    0    0    0    0    0
Misdirection          0    6    3    0    0    0    0    0
Not Dark Pattern      0    0    9    0    0    0    1    2
Obstruction           0    0    6    0    0    0    0    0
Scarcity              0    0    1    0    8    0    0    0
Sneaking              2    1    3    0    0    0    1    1
Social Proof          0    0    0    0    0    0    8    0
Urgency               0    0    0    0    2    0    0    7
```

The full machine-readable report (every prediction + score) is in
[`eval/results.json`](../eval/results.json).

## Limitations

1. **Three categories are effectively undetected** by the model on this set — Forced Action,
   Obstruction, and Sneaking nearly all collapse to "Not Dark Pattern." These are the more
   subtle, context-dependent patterns.
2. **"Not Dark Pattern" is a sink:** it has high recall (75%) but low precision (30%) —
   i.e. many genuine dark patterns are misfiled as benign (false negatives), which is the
   more harmful error direction for a protection tool.
3. **Minor adjacent confusion** between Urgency and Scarcity is expected (overlapping cues).
4. **Small, curated evaluation set** — not representative of real page-text distribution.
5. **English-only, short-text only, quantized** (`q8` may cost a little accuracy vs. fp32).

### How the product mitigates this

DigiCom is a **hybrid** system. The Stage 1 heuristics in `detection.js` independently catch
manipulative phrasing via regex, **including dedicated rules for the three classes the model
is weakest on** — Forced Action, Obstruction, and Sneaking (added from web-sourced examples
in [`data/collected.jsonl`](../data/collected.jsonl); see
[`test/detection.test.mjs`](../test/detection.test.mjs)). So in the running product these
patterns are still detected even though the ML stage misses them. The ML metrics above are
unchanged by this — they measure the model in isolation; fixing the model itself still
requires retraining (see [Recommended follow-ups](#recommended-follow-ups)).

## Ethical considerations

- **Error trade-off:** false negatives (missed manipulation) leave users unprotected; false
  positives (over-flagging) erode trust and add noise. The user-adjustable confidence
  threshold lets users tune this.
- **Privacy:** inference is 100% on-device; no page text leaves the browser.
- **Not authoritative:** highlights are informational signals, not legal determinations.

## Recommended follow-ups

- ~~Add heuristic rules for **Obstruction** and **Sneaking** in `detection.js`~~ ✅ done
  (Stage 1 now covers all weak classes; ML still needs work).
- Expand `eval/dataset.jsonl` with real, independently-labeled page snippets; re-run `npm run eval`.
- Use [`data/collected.jsonl`](../data/collected.jsonl) to **retrain/fine-tune** the model so
  the ML stage (not just heuristics) detects Forced Action / Obstruction / Sneaking.
- Retrain / fine-tune to lift Forced Action / Obstruction / Sneaking recall, then re-export
  (update both model copies via `npm run sync-model`) and refresh this card.

## Reproducibility

| Artifact           | Path                                              |
| ------------------ | ------------------------------------------------- |
| Evaluation script  | [`scripts/evaluate.mjs`](../scripts/evaluate.mjs) |
| Evaluation dataset | [`eval/dataset.jsonl`](../eval/dataset.jsonl)     |
| Latest results     | [`eval/results.json`](../eval/results.json)       |
| Command            | `npm run eval`                                    |

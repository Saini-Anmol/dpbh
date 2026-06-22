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

### Results (71 examples, 8 classes) — retrained model

Retrained on the balanced `Title,Category` dataset (~200/class). Big jump on the three
classes the original model missed entirely.

| Metric          | Value     |
| --------------- | --------- |
| Accuracy        | **91.5%** |
| Macro F1        | **91.8%** |
| Weighted F1     | **91.4%** |
| Macro precision | 92.5%     |
| Macro recall    | 92.9%     |

Per-class:

| Class            | Precision | Recall |     F1 | Support |
| ---------------- | --------: | -----: | -----: | ------: |
| Forced Action    |     83.3% | 100.0% |  90.9% |      10 |
| Misdirection     |    100.0% |  88.9% |  94.1% |       9 |
| Not Dark Pattern |    100.0% |  66.7% |  80.0% |      12 |
| Obstruction      |     75.0% | 100.0% |  85.7% |       6 |
| Scarcity         |    100.0% | 100.0% | 100.0% |       9 |
| Sneaking         |    100.0% |  87.5% |  93.3% |       8 |
| Social Proof     |    100.0% | 100.0% | 100.0% |       8 |
| Urgency          |     81.8% | 100.0% |  90.0% |       9 |

For reference, the **original** model scored 53.5% accuracy / 44.5% macro-F1, with **0% F1 on
Forced Action, Obstruction, and Sneaking**.

Confusion matrix (rows = true label, columns = predicted):

```
                   Forc Misd Not  Obst Scar Snea Soci Urge
Forced Action        10    0    0    0    0    0    0    0
Misdirection          0    8    0    1    0    0    0    0
Not Dark Pattern      2    0    8    0    0    0    0    2
Obstruction           0    0    0    6    0    0    0    0
Scarcity              0    0    0    0    9    0    0    0
Sneaking              0    0    0    1    0    7    0    0
Social Proof          0    0    0    0    0    0    8    0
Urgency               0    0    0    0    0    0    0    9
```

The full machine-readable report (every prediction + score) is in
[`eval/results.json`](../eval/results.json).

## Limitations

1. **Small evaluation set** (71 examples) — directional, not a production benchmark. Expand
   for stronger guarantees.
2. **English-only, short-text only.** Long-form text is filtered out before classification.
3. **Quantized model is larger than ideal** (~194 MB): `quantize_dynamic` left the token
   embeddings in fp32. It runs fine but the package is heavier than the previous 67 MB build;
   improving the quantization (quantizing embeddings) is a follow-up.
4. The previous version's blind spots (Forced Action / Obstruction / Sneaking at 0% F1) are
   **resolved** by this retrain.

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

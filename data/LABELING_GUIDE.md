# Dark-pattern labeling guide

Use these definitions to label `text` snippets. Pick the **single** best-fitting class.
Labels must match these strings **exactly**.

## The 8 classes

| Label                | Definition                                                                                                                                                                        | Example snippets                                                                                                                      |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Forced Action**    | Forces the user to do something (create an account, share data, agree to marketing, enable notifications) in order to access content, see a price, or continue.                   | "Create an account to continue", "Sign up to see the price", "I agree to receive marketing emails", "Enable notifications to proceed" |
| **Obstruction**      | Makes a task — _especially cancelling, unsubscribing, deleting an account, or opting out_ — deliberately hard: roundabout, multi-step, phone/mail-only, or hidden.                | "To cancel, call us 9–5", "Account deletion must be requested in writing", "You can only unsubscribe by mail"                         |
| **Sneaking**         | Hides, disguises, or delays information relevant to the decision: items sneaked into cart, hidden fees / drip pricing, hidden auto-renewal or subscription, pre-selected add-ons. | "A $9.99 service fee was added", "Auto-renews at $59/year after trial", "Your cart includes a pre-selected warranty"                  |
| **Scarcity**         | Pressure via limited availability / stock.                                                                                                                                        | "Only 2 left in stock!", "Almost gone"                                                                                                |
| **Urgency**          | Pressure via limited time / countdowns / deadlines.                                                                                                                               | "Sale ends in 00:05:00", "Today only"                                                                                                 |
| **Social Proof**     | Pressure via others' activity (views, purchases, popularity).                                                                                                                     | "27 people are viewing this", "1,204 sold today"                                                                                      |
| **Misdirection**     | Steers the choice via guilt/shame (confirmshaming) or visual misdirection.                                                                                                        | "No thanks, I'd rather pay full price"                                                                                                |
| **Not Dark Pattern** | Neutral, non-manipulative UI text.                                                                                                                                                | "Add to cart", "Free shipping over $50", "Return policy: 30 days"                                                                     |

## Disambiguation tips

- **Forced Action vs Obstruction:** Forced Action _adds a required step to proceed_;
  Obstruction _blocks/hinders an exit_ (cancel, opt-out, delete).
- **Sneaking vs Forced Action:** Sneaking _hides_ a cost/enrollment; Forced Action _openly
  demands_ an action. "You'll be enrolled unless you cancel" (hidden default) = Sneaking;
  "Subscribe to continue" (explicit gate) = Forced Action.
- **Sneaking vs Urgency/Scarcity:** if the core trick is a _hidden cost/charge/renewal_, it's
  Sneaking even if it mentions time.
- When a snippet is plain/neutral, label **Not Dark Pattern** — don't over-label.

## Trusted sources (prefer these)

- **deceptive.design** (Harry Brignull) — type pages and "hall of shame".
- **Mathur et al. (2019), "Dark Patterns at Scale"** + its public dataset; Gray et al. taxonomy.
- **FTC**, "Bringing Dark Patterns to Light" (2022).
- **EU EDPB** dark-pattern guidelines; **Norwegian Consumer Council**, "Deceived by Design".
- **India CCPA**, "Guidelines for Prevention and Regulation of Dark Patterns, 2023" (lists examples).
- Reputable consumer-protection / academic write-ups with concrete example copy.

## Quality rules

- Realistic, short UI copy (≈10–300 chars), English.
- Anonymize brand names / PII; keep phrasing natural.
- One class per line; dedupe (case-insensitive) against existing data.
- Prefer real, representative copy over invented text; cite the `source` URL.

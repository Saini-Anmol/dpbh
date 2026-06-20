---
name: source-yield
description: Which trusted sources reliably yield Obstruction / Sneaking / Forced Action example copy for the dark-pattern dataset
metadata:
  type: reference
---

High-yield sources by weak class (verified 2026-06-21 collection session):

- **Obstruction (hard-to-cancel / opt-out)**: FTC "Bringing Dark Patterns to Light" (2022) staff report PDF (ftc.gov P214800) — richest for cancellation-by-phone, limited-hours, mail-only, immortal-accounts copy. Amazon "Iliad Flow" paper (arxiv.org/pdf/2309.09635) — multi-step cancellation page copy. Norwegian Consumer Council "Deceived by Design" (forbrukerradet.no / consumerwatchdog.org PDF) — privacy opt-out obstruction (no Reject All, manual per-setting). deceptive.design Chapter 19 + /types/hard-to-cancel.
- **Sneaking (hidden cost / sneak-into-basket / hidden subscription)**: Mathur et al. "Dark Patterns at Scale" PDF (webtransparency.cs.princeton.edu) — concrete dollar examples (care&handling $2.99, greeting card $3.99, wsjwine $89 annual renewal). MediaNama "Dark Patterns in India's Online Marketplaces" deck — India-specific platform fee, rain surcharge, Zepto Pass, BookMyShow ₹1 charity, advance tip nudges. deceptive.design /types/hidden-costs and /types/hidden-subscription (Figma collaborator-charge example).
- **Forced Action (forced enrollment / cookie wall / data demand)**: deceptive.design /types/forced-action (LinkedIn email-harvest "add your email"). Cookie-wall write-ups (cookieyes, termsfeed, clym) for "accept cookies to continue" + "consent or pay". NCC "Deceived by Design" for "if you don't accept these terms you can't continue".

India / CCPA reference: full CCPA 2023 Guidelines text at nls.ac.in/wp-content/uploads/2021/04/Dark-Patterns.pdf — defines 13 patterns incl. Basket Sneaking, Forced Action, Subscription Trap, Drip Pricing. Note: CCPA "necessary fees" (delivery, taxes, gift wrap, govt charges) disclosed upfront are NOT basket sneaking — do not label disclosed mandatory fees as Sneaking.

High-yield sources for the other classes (verified 2026-06-21 balanced run):

- **Scarcity / Urgency / Social Proof (the "false-belief" cluster)**: agg.com "The FTC Blacklists Dark Patterns" gives the cleanest FTC-attributed copy ("only two left when stock is plentiful", "28 people have added this to their cart", "39 other people are viewing this item"). deceptive.design Chapter 17 (social proof — Etsy "3 people have this in their carts", Sales Pop fabricated geo notifications) and /types/fake-urgency (Hurrify resetting countdown). scandiweb / drip.com / tcf.team scarcity-marketing posts = lots of naturalistic stock/timer copy AND the "5 dark patterns to avoid" framing (reset-on-reload timer, never-moving stock count).
- **Misdirection (confirmshaming + asymmetric choice)**: nngroup.com "Deceptive Patterns in UX" (manipulink "No thanks, I don't like saving money"), eleken.co / creative-cx.com (MyMedic "I'd rather bleed to death" / "I don't want to stay alive"), agg.com (double-negative trick question "uncheck the box if you are unopposed to not receiving emails"). NCC "Deceived by Design" for visual-hierarchy/aesthetic-manipulation copy.
- **Not Dark Pattern HARD NEGATIVES**: chargebee/momence click-to-cancel posts (transparent "cancel anytime, two clicks"), yotpo / dealhub pricing-transparency glossaries (all-in pricing, "no hidden fees"), convertcart countdown post ("Order in 2h 10m to get it by Tuesday" = legit shipping cutoff, NOT urgency), referralcandy ("4.5/5 based on 2,847 verified purchases" = legit social proof with methodology). These mirror the dark-pattern copy but are honest — ideal false-positive reducers.

State after 2026-06-21 balanced run: data/collected.jsonl now holds 241 lines, ~30 per class across all 8 (Obstruction 31). Fully balanced; next sessions should focus on diversity-within-class (more industries: travel, SaaS, food delivery, fintech) and additional India-platform copy rather than raw counts.

New high-yield sources from the 2026-06-21 deepening run (added 20/class → ~50/class, file now 401 lines):

- **FTC subscription/auto-renew enforcement 2024-2026**: hklaw.com (FTC v. Uber One + Cleo AI, ROSCA — phone-only/circuitous cancellation, undisclosed auto-renew); cookie-script.com click-to-cancel-2026 (chatbot/phone cancellation now barred). Good for Obstruction (cancellation barriers) + Sneaking (buried auto-renew).
- **Food-delivery drip pricing (FTC v. Grubhub, Dec 2024)**: regulations.gov FTC-2026-0463-0001 + duanemorris.com (state AGs letter) + inkwoodresearch.com fee-stack breakdown. Richest for late-revealed delivery/service/small-order/regulatory-response fees, surge, menu markup = Sneaking. Also Minnesota/California (SB 478, Fenwick) all-in-pricing law = ideal Not-Dark-Pattern Sneaking near-misses.
- **OTA scarcity**: nbcnews.com Checkbook study (Priceline/Expedia "only 1 room left" = cherry-picked obscure room type) + ro-che.info Booking.com teardown ("in high demand, only N rooms left", "prices rising"). Best naturalistic hotel/flight Scarcity + Urgency copy.
- **SaaS dark patterns**: foundey.com/blog/dark-patterns-in-saas — resetting timers, "limited beta spots", trial-end deadlines, free-to-paid silent conversion, false-hierarchy plan cards. Covers SaaS Urgency/Scarcity/Sneaking/Misdirection in one place.
- **Fake social proof**: pingbell.io ("Samantha from Boston just bought" rotating-name popup), provesrc.com (geo live-purchase/visitor counts). complydog.com for "47 bought in last hour", self-awarded badges, stale #1-App-Store rankings.
- **Cookie-banner Misdirection**: ethyca.com / secureprivacy.ai / cookieinformation.com / ignite.video — green Accept-all vs grey Manage link, pre-checked boxes, below-fold reject. Distinguish from Forced Action (cookie WALL = Forced Action; asymmetric-but-both-present = Misdirection).
- **Account deletion Obstruction**: voices.uchicago.edu CSCW2022 account-deletion study (buried delete, forced external steps, expiring tokens). ketch.com (Honda 2024 two-step rejection, LinkedIn buried opt-outs). gdpr-info.eu Art.17 for "30-day delay + ID upload" framing.
- **Forced biometric/identity**: tinderpressroom.com (mandatory Face Check onboarding), iproov.com / innovatrics.com (selfie-liveness gating), support.unyte.com (Face ID enable). Good for the newer Forced-Action sub-patterns (biometric enrollment, ID upload, social-login-only).

State after 2026-06-21 deepening run: 401 lines, exactly 50/class except Obstruction 51. All 160 new lines validated: 10-300 chars, valid JSON, zero intra-file dupes, zero collisions with eval/dataset.jsonl. Coverage now spans travel/OTA, SaaS, food delivery, ride-hailing, fintech, fashion, event ticketing, cookie consent. Next gaps: ride-hailing and fintech still thinnest; could add more non-US/India-regulator-attributed copy (CCPA notices) and EU DSA/EDPB-specific decisions.

See [[labeling-edge-cases]].

---
name: labeling-edge-cases
description: Recurring class-boundary decisions when labeling dark-pattern text for the DigiCom dataset (Obstruction/Sneaking/Forced Action/Misdirection)
metadata:
  type: feedback
---

Class-boundary rules applied when curating, per data/LABELING_GUIDE.md:

- **Asymmetric-choice button labels are Misdirection, not Obstruction.** "Keep My Benefits" / "Continue to Cancel" / "Remind Me Later" (Amazon Iliad flow) are visual-prominence/false-hierarchy = Misdirection. Reserve Obstruction for copy describing the _difficulty of the exit itself_ ("cancel only by phone during business hours", "no Reject All button — adjust each setting manually").
  **Why:** Guide says Forced Action adds a step to proceed, Obstruction hinders an exit, Misdirection steers the choice via shaming/visual trickery. A confusing button steers; a phone-only cancellation policy hinders.
  **How to apply:** When the snippet is a single button label, ask whether it shames/misleads (Misdirection) vs. states a burdensome process (Obstruction).

- **Cookie walls / "accept or you can't continue" = Forced Action, not Obstruction.** It gates entry (a required step to proceed), it does not block an exit.
  **Why:** Forced Action = required step to proceed. **How to apply:** "Accept cookies to continue", "consent or pay to read" → Forced Action.

- **Disclosed mandatory fees are NOT Sneaking.** Per CCPA, delivery charges, taxes, gift wrap, and other necessary fees _explicitly disclosed at time of purchase_ are excluded from basket sneaking. Only label Sneaking when the charge is hidden/late-revealed/pre-selected/auto-added.
  **How to apply:** "Free shipping over $50" and upfront-disclosed delivery fees = Not Dark Pattern; "a $2.99 handling charge added at the final step" = Sneaking.

- **Hidden auto-renewal = Sneaking; explicit "subscribe to continue" gate = Forced Action.** Hidden default enrollment ("renews automatically unless you cancel") is Sneaking; an openly-demanded subscription step is Forced Action.

- **Cart/view-count "fake activity" = Social Proof, even though it mentions a quantity.** "28 people have added this to their cart", "39 others are viewing this", "3 people have this in their carts right now" pressure via OTHERS' activity, not via the item's own stock. Reserve Scarcity for the item's own availability ("only 2 left"). Edge case "Only 4 left — and they're in 12 other carts": label by the PRIMARY hook — if stock count leads, Scarcity; if the crowd activity leads, Social Proof.
  **Why:** Guide defines Social Proof as pressure via others' activity (views/purchases/popularity) and Scarcity as limited availability/stock.

- **Resetting/baseless countdown timers and time-deadline copy = Urgency; quantity copy = Scarcity.** "Sale ends in 02:14:33", "price goes up at midnight", cart-reservation timers = time pressure (Urgency). "Only 50 units", "selling fast", "almost sold out" = quantity (Scarcity). Booking-style "only 10 minutes left to claim this deal" is time-led = Urgency; "only 2 rooms left at this price" is stock-led = Scarcity.

- **HARD NEGATIVES that look like dark patterns but are Not Dark Pattern:** transparent cancellation ("cancel anytime, two clicks, no fees"), all-in/honest pricing ("all taxes and fees included", "no hidden fees"), genuine social proof WITH methodology ("4.5/5 based on 2,847 verified purchases"), real shipping cutoffs ("Order in 2h 10m to get it by Tuesday"), optional clearly-labelled opt-ins/add-ons, one-click symmetric cookie reject. The DISTINGUISHER is transparency + symmetry + truthfulness, not the topic. Collect these to reduce classifier false positives.

See [[source-yield]].

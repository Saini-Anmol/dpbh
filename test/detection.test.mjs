import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { loadExtensionScript } from "./helpers.mjs";

before(() => loadExtensionScript("detection.js"));

describe("classifyHeuristic", () => {
  const cases = [
    ["Hurry, sale ends soon!", "Urgency"],
    ["Offer ends in 2 hours left", "Urgency"],
    ["Only 3 left in stock!", "Scarcity"],
    ["Almost gone — selling fast", "Scarcity"],
    ["27 people are viewing this right now", "Social Proof"],
    ["No thanks, I'd rather pay full price", "Misdirection"],
    ["Create an account to continue reading", "Forced Action"],
    ["I agree to receive marketing emails", "Forced Action"],
    ["Accept cookies to continue to the website", "Forced Action"],
    ["Download the app to complete this order", "Forced Action"],
    ["Verify your phone number to finish checkout", "Forced Action"],
    [
      "To cancel your membership, please call customer service during business hours.",
      "Obstruction",
    ],
    ["Account deletion can only be requested through a support ticket.", "Obstruction"],
    ["There is no Reject All button; opt out of each setting manually.", "Obstruction"],
    ["A $9.99 service fee will be added at the final step of checkout.", "Sneaking"],
    ["Your one-time payment of $89 will renew automatically every year.", "Sneaking"],
    ["Shipping protection has been added to your cart.", "Sneaking"],
  ];

  for (const [text, category] of cases) {
    it(`flags "${text}" as ${category}`, () => {
      const result = DigiComDetection.classifyHeuristic(text);
      assert.equal(result?.category, category);
      assert.ok(["high", "moderate", "low"].includes(result.severity));
    });
  }

  it("returns null for benign copy (false-positive guard)", () => {
    const benign = [
      "Free shipping on all orders",
      "Add to cart",
      "Our return policy lasts 30 days",
      "Sign in to your account",
      "Manage your settings",
      "All taxes included in the price shown",
      "Cancel anytime from your account settings",
      "Add your favourite items to your wishlist",
      "Call us for product support",
    ];
    for (const text of benign) {
      assert.equal(DigiComDetection.classifyHeuristic(text), null, `should not flag: ${text}`);
    }
  });

  it("ignores text outside length bounds", () => {
    assert.equal(DigiComDetection.classifyHeuristic("hi"), null); // too short
    assert.equal(DigiComDetection.classifyHeuristic("x".repeat(401)), null); // too long
  });

  it("handles null/undefined safely", () => {
    assert.equal(DigiComDetection.classifyHeuristic(null), null);
    assert.equal(DigiComDetection.classifyHeuristic(undefined), null);
  });
});

describe("looksLikeUIText", () => {
  it("accepts short UI-like phrases", () => {
    assert.equal(DigiComDetection.looksLikeUIText("Sign up to continue"), true);
  });

  it("rejects too-short / too-long text", () => {
    assert.equal(DigiComDetection.looksLikeUIText("hi"), false);
    assert.equal(DigiComDetection.looksLikeUIText("word ".repeat(80)), false);
  });

  it("rejects JSON/XML leftovers", () => {
    assert.equal(DigiComDetection.looksLikeUIText('{"key": "value here"}'), false);
    assert.equal(DigiComDetection.looksLikeUIText("<div>content here</div>"), false);
  });

  it("rejects pure-numeric and single tokens", () => {
    assert.equal(DigiComDetection.looksLikeUIText("1,234.56 $99"), false);
    assert.equal(DigiComDetection.looksLikeUIText("supercalifragilistic"), false);
  });
});

describe("isBenignUIText (false-positive guard)", () => {
  it("treats common e-commerce nav/policy labels as benign", () => {
    const benign = [
      "Contact us",
      "Cancellation & Returns",
      "Returns",
      "Return Policy",
      "Track Order",
      "My Account",
      "Sign in",
      "Privacy Policy",
      "Terms & Conditions",
      "Help Center",
      "Add to cart",
    ];
    for (const t of benign) {
      assert.equal(DigiComDetection.isBenignUIText(t), true, `should be benign: ${t}`);
    }
  });

  it("does NOT mark genuine dark-pattern sentences as benign", () => {
    const real = [
      "To cancel your membership, please call customer service during business hours.",
      "A $9.99 service fee will be added at the final step of checkout.",
      "Only 2 left in stock!",
      "27 people are viewing this right now",
      "Create an account to continue reading",
    ];
    for (const t of real) {
      assert.equal(DigiComDetection.isBenignUIText(t), false, `should NOT be benign: ${t}`);
    }
  });
});

describe("hashText", () => {
  it("is deterministic and trims", () => {
    assert.equal(DigiComDetection.hashText("Buy now"), DigiComDetection.hashText("  Buy now  "));
  });

  it("differs for different text", () => {
    assert.notEqual(DigiComDetection.hashText("Buy now"), DigiComDetection.hashText("Buy later"));
  });
});

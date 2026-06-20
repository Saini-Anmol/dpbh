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
  ];

  for (const [text, category] of cases) {
    it(`flags "${text}" as ${category}`, () => {
      const result = DigiComDetection.classifyHeuristic(text);
      assert.equal(result?.category, category);
      assert.ok(["high", "moderate", "low"].includes(result.severity));
    });
  }

  it("returns null for benign copy", () => {
    assert.equal(DigiComDetection.classifyHeuristic("Free shipping on all orders"), null);
    assert.equal(DigiComDetection.classifyHeuristic("Add to cart"), null);
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

describe("hashText", () => {
  it("is deterministic and trims", () => {
    assert.equal(DigiComDetection.hashText("Buy now"), DigiComDetection.hashText("  Buy now  "));
  });

  it("differs for different text", () => {
    assert.notEqual(DigiComDetection.hashText("Buy now"), DigiComDetection.hashText("Buy later"));
  });
});

import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { loadExtensionScript } from "./helpers.mjs";

before(() => loadExtensionScript("settings.js"));

describe("normalize", () => {
  it("fills defaults from empty/invalid input", () => {
    for (const input of [undefined, null, 42, "nope"]) {
      const s = DigiComSettings.normalize(input);
      assert.equal(s.enabled, true);
      assert.equal(s.threshold, 0.7);
      assert.equal(Object.keys(s.categories).length, 7);
      assert.deepEqual(s.disabledSites, []);
    }
  });

  it("clamps threshold to [0.5, 0.95] and falls back on non-numbers", () => {
    assert.equal(DigiComSettings.normalize({ threshold: 5 }).threshold, 0.95);
    assert.equal(DigiComSettings.normalize({ threshold: 0 }).threshold, 0.5);
    assert.equal(DigiComSettings.normalize({ threshold: "x" }).threshold, 0.7);
  });

  it("keeps known category booleans, drops unknown keys", () => {
    const s = DigiComSettings.normalize({ categories: { Urgency: false, Bogus: true } });
    assert.equal(s.categories.Urgency, false);
    assert.equal(s.categories.Scarcity, true); // untouched default
    assert.equal("Bogus" in s.categories, false);
  });

  it("dedupes and filters disabledSites", () => {
    const s = DigiComSettings.normalize({
      disabledSites: ["a.com", "a.com", "", "  ", 5, "b.com"],
    });
    assert.deepEqual([...s.disabledSites].sort(), ["a.com", "b.com"]);
  });
});

describe("isActive / isSiteDisabled", () => {
  it("is inactive on a disabled site, active elsewhere", () => {
    const s = DigiComSettings.normalize({ disabledSites: ["x.com"] });
    assert.equal(DigiComSettings.isSiteDisabled(s, "x.com"), true);
    assert.equal(DigiComSettings.isActive(s, "x.com"), false);
    assert.equal(DigiComSettings.isActive(s, "y.com"), true);
  });

  it("is inactive everywhere when globally disabled", () => {
    const s = DigiComSettings.normalize({ enabled: false });
    assert.equal(DigiComSettings.isActive(s, "y.com"), false);
  });
});

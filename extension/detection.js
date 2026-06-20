// Pure detection logic — no DOM, no chrome APIs. Shared by the content script (loaded as a
// classic script before content.js) and exercised directly by the unit tests in test/.
// Attaches its API to globalThis.DigiComDetection.

(function () {
  const HEURISTICS = [
    {
      category: "Urgency",
      severity: "moderate",
      patterns: [
        /\b(hurry|limited\s+time|ending\s+soon|sale\s+ends|offer\s+ends|flash\s+sale|don'?t\s+miss)\b/i,
        /\b\d{1,3}\s*(days?|hrs?|hours?|mins?|minutes?|secs?|seconds?)\b.*\b(left|remaining|to\s+go)\b/i,
        /\b\d{2}:\d{2}(:\d{2})?\b.*\b(left|remaining|ends)\b/i,
      ],
    },
    {
      category: "Scarcity",
      severity: "moderate",
      patterns: [
        /\bonly\s+\d+\s+(left|remaining|in\s+stock|items?)\b/i,
        /\b(almost\s+gone|selling\s+fast|low\s+stock|last\s+chance|limited\s+quantity)\b/i,
        /\b\d+\s+(items?|left|remaining)\b.*\b(in\s+stock|available)\b/i,
      ],
    },
    {
      category: "Social Proof",
      severity: "low",
      patterns: [
        /\b\d+\s+(people|customers?|shoppers?|users?)\s+(are|just|have|viewed|bought|purchased|viewing|looking|added)\b/i,
        /\bsomeone\s+(in|from)\s+\w+.*\b(bought|purchased|just|ordered)\b/i,
        /\b\d+\s+(bought|sold|purchased|viewed)\s+(in|today|this|recently|in\s+the\s+last)\b/i,
      ],
    },
    {
      category: "Misdirection",
      severity: "moderate",
      patterns: [
        /\bno\s*,?\s*(thanks?|thank\s+you)?\s*,?\s*i['']?(d|ll)?\s*(rather|prefer|like|want|don'?t)\s+.{0,40}(pay\s+full|save\s+money|discount|free|savings?|deals?)/i,
        /\bi\s+don'?t\s+(want|like|need)\s+(to\s+save|free|discounts?|deals?)/i,
        /\bnah[,!]?\s+i/i,
      ],
    },
    {
      category: "Forced Action",
      severity: "high",
      patterns: [
        /\bi\s+agree\s+to\s+receive\s+(marketing|promotional|automated)\b/i,
        /\bsign\s+(up|in)\s+(now|to\s+continue|required)\b.*\b(to\s+read|to\s+see|to\s+view|to\s+access)/i,
        /\bcreate\s+an?\s+account\s+to\s+(continue|read|view|access)\b/i,
      ],
    },
  ];

  const SEVERITY_MAP = {
    "Forced Action": "high",
    Obstruction: "high",
    Sneaking: "high",
    Urgency: "moderate",
    Scarcity: "moderate",
    Misdirection: "moderate",
    "Social Proof": "low",
  };

  // Length bounds for ML candidate text (filters out noise / huge paragraphs).
  const ML_MIN_LEN = 10;
  const ML_MAX_LEN = 300;

  // -----  Heuristic classification  -----
  function classifyHeuristic(text) {
    const trimmed = String(text ?? "").trim();
    if (trimmed.length < 4 || trimmed.length > 400) return null;
    for (const rule of HEURISTICS) {
      for (const pattern of rule.patterns) {
        if (pattern.test(trimmed)) {
          return { category: rule.category, severity: rule.severity };
        }
      }
    }
    return null;
  }

  function looksLikeUIText(text) {
    // Filter out obvious non-UI noise: JSON-ish, CSS, very long paragraphs.
    if (text.length < ML_MIN_LEN || text.length > ML_MAX_LEN) return false;
    if (/^\s*[[{<]/.test(text)) return false; // JSON/XML leftovers
    if (/^[\d\s.,%$₹€£-]+$/.test(text)) return false; // pure numeric
    if ((text.match(/\s/g) || []).length < 1) return false; // single token
    return true;
  }

  function hashText(text) {
    // djb2 — good enough to dedupe identical text across nodes.
    let h = 5381;
    const s = String(text ?? "").trim();
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return h.toString(36);
  }

  globalThis.DigiComDetection = {
    HEURISTICS,
    SEVERITY_MAP,
    ML_MIN_LEN,
    ML_MAX_LEN,
    classifyHeuristic,
    looksLikeUIText,
    hashText,
  };
})();

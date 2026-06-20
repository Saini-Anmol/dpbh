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
        // Gated entry: an action demanded in order to continue/access (cookie walls,
        // forced sign-up/app/social login, contact-info or permission gates).
        /\b(accept\s+(all\s+)?cookies|accept\s+(tracking|ads)|allow\s+(location|notification)|enable\s+notifications|verify\s+your\s+(phone|email|number)|download\s+the\s+app|sign\s+in\s+with|sign\s+up|create\s+an?\s+account|provide\s+your\s+(name|email|phone|mobile|number|contact)|add(ing)?\s+your\s+(email|phone|number|contact)|share\s+your\s+contacts|opt\s+in\b|(must\s+)?agree\s+to\s+(our\s+|the\s+)?(terms|privacy|policy))\b.{0,45}\b(to\s+(continue|proceed|complete|finish|access|view|use|checkout|read|see|register|book)|before\s+you\s+(can|continue)|to\s+finish\s+checkout|only\s+way\s+to\s+access|or\s+pay|to\s+your\s+(feed|account))\b/i,
        /\bif\s+you\s+don'?t\s+(accept|agree|allow|enable|provide)\b.{0,45}\b(can'?t|cannot|can\s+not|unable)\b/i,
      ],
    },
    {
      category: "Obstruction",
      severity: "high",
      patterns: [
        // Cancellation / account-exit / opt-out friction: an exit intent paired with a
        // burdensome channel (phone, mail, in writing, business hours, extra steps, etc.).
        /(?=.*\b(cancel\w*|unsubscrib\w*|deactivat\w*|delet\w*\s+(my\s+|your\s+)?(account|data|profile)|account\s+(deletion|cancellation|closure|removal)|clos\w*\s+(my\s+|your\s+)?account|end\w*\s+(your|my)\s+(subscription|membership)|stop\w*\s+(recurring\s+)?billing|opt[\s-]?out)\b)(?=.*\b(call|phone|by\s+post|by\s+mail|mail\s+a|in\s+writing|written|write\s+to|business\s+hours|limited\s+hours|monday|tuesday|wednesday|thursday|friday|support\s+ticket|retention|in\s+person|second\s+email|contact(ing)?\s+(our\s+)?(support|customer)|speak\s+with|exclusively|another\s+method|redirect\w*|scroll\s+to\s+the\s+bottom|navigate\s+through|several\s+(more\s+)?steps|all\s+\w+\s+steps|complete\s+(all|additional|the\s+next)|review\s+the\s+next|restart\s+the\s+(cancellation|process)|further\s+verification|listen\s+to\s+(this|our)\s+offer|each\s+step|cannot\s+be|can\s+only\s+be)\b)/i,
        /\bcannot\s+be\s+(cancel\w*|delet\w*|clos\w*|remov\w*)\b.{0,25}\b(online|here|on\s+(our|this)\s+(site|app)|this\s+option)\b/i,
        /\bno\s+["“]?reject[\s-]?all\b/i,
        /\b(reject\s+all|opt[\s-]?out|turn\s+off|manage\s+(data\s+)?settings)\b.{0,45}\b(individually|manually|each\s+(option|setting|one|step))\b/i,
      ],
    },
    {
      category: "Sneaking",
      severity: "high",
      patterns: [
        // Items / fees sneaked into the order, or revealed only at the final step.
        /\b(has|have|will|is|are)\s+(been\s+|be\s+)?(added|applied|calculated|charged|included)\b.{0,35}\b(to\s+your\s+(order|cart|bill|total|ticket|basket)|at\s+checkout|at\s+the\s+(final|last|payment)|by\s+default|on\s+the\s+payment|before\s+you\s+(complete|pay))\b/i,
        // Hidden subscription / auto-renewal / drip billing.
        /\b(renew(s|ed|al)?\s+automatically|automatically\s+renew|auto[\s-]?renew|will\s+renew|renews?\s+(each|every)\s+(year|month)|billed\s+(separately|automatically)|recurring\s+(charge|payment|fee|billing)|convert\s+to\s+a\s+paid|charged\s+the\s+full\s+subscription|charged\b.{0,25}\bautomatically|unless\s+you\s+cancel)\b/i,
        // Fees excluded from the displayed price (drip pricing).
        /\b(not\s+included|exclude[sd]?|excluding)\b.{0,30}\b(fee|fees|charge|charges|tax|taxes|rate|price|surcharge)\b/i,
        // Pre-selected add-ons / defaults.
        /\b(already\s+included|pre[\s-]?selected|pre[\s-]?ticked|pre[\s-]?checked|added\s+by\s+default)\b/i,
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

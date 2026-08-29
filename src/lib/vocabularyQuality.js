const TEMPLATE_EXAMPLE_MARKERS = [
  "这个词用于",
  "今天我们学习",
  "ช่วยอธิบายคำว่า",
  "ฉันใช้คำว่า",
];

export function normalizeVocabularyText(value) {
  return String(value || "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ");
}

export function hasTemplateExample(word) {
  const example = normalizeVocabularyText(word?.example_chinese);
  const thaiExample = normalizeVocabularyText(word?.example_thai);
  return TEMPLATE_EXAMPLE_MARKERS.some(
    (marker) => example.includes(marker) || thaiExample.includes(marker)
  );
}

export function hasCoreVocabularyFields(word) {
  return Boolean(
    normalizeVocabularyText(word?.thai_word) &&
      normalizeVocabularyText(word?.chinese_meaning)
  );
}

export function auditVocabulary(words = []) {
  const seen = new Set();
  const issues = [];

  words.forEach((word, index) => {
    const thai = normalizeVocabularyText(word?.thai_word);
    const key = thai || `row-${index}`;

    if (!hasCoreVocabularyFields(word)) {
      issues.push({ type: "missing_core_fields", index, word });
    }

    if (thai && seen.has(thai)) {
      issues.push({ type: "duplicate_thai", index, word });
    }
    if (thai) seen.add(thai);

    if (hasTemplateExample(word)) {
      issues.push({ type: "template_example", index, word });
    }
  });

  return issues;
}

export function isVerifiedVocabulary(word) {
  return (
    word?.review_status === "verified" &&
    hasCoreVocabularyFields(word) &&
    !hasTemplateExample(word)
  );
}

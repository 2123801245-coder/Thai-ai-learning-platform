import { VOCABULARY_BOOKS, VOCABULARY_BOOK_TARGET } from "@/data/bookCatalog";

const SOURCE_URL = "https://raw.githubusercontent.com/PyThaiNLP/Phupha-Word-freq/main/wordfreq.csv";

const normalize = (value) =>
  String(value || "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ");

const isThaiCandidate = (word) => {
  const value = normalize(word);
  return value.length >= 2 && /[\u0E00-\u0E7F]/.test(value) && !/^[-.\d]+$/.test(value);
};

function parseFrequencyCsv(csv) {
  const candidates = [];
  const seen = new Set();

  for (const line of String(csv || "").split(/\r?\n/).slice(1)) {
    const separator = line.lastIndexOf(",");
    if (separator < 1) continue;

    const word = normalize(line.slice(0, separator));
    const count = Number(line.slice(separator + 1).trim());
    if (!isThaiCandidate(word) || !Number.isFinite(count) || seen.has(word)) continue;

    seen.add(word);
    candidates.push({ word, count });
  }

  return candidates.sort((a, b) => b.count - a.count);
}

export async function loadVocabularyCandidates(existingWords = []) {
  const existing = new Set(
    existingWords.map((word) => normalize(word.thai_word)).filter(Boolean)
  );
  const response = await fetch(SOURCE_URL, { cache: "force-cache" });
  if (!response.ok) throw new Error(`Thai candidate source returned ${response.status}`);

  const candidates = parseFrequencyCsv(await response.text()).filter(
    (candidate) => !existing.has(candidate.word)
  );
  const staged = [];
  let cursor = 0;

  for (const book of VOCABULARY_BOOKS) {
    const words = candidates.slice(cursor, cursor + VOCABULARY_BOOK_TARGET);
    cursor += words.length;
    staged.push(
      ...words.map((candidate, index) => ({
        id: `candidate-${book}-${String(index + 1).padStart(4, "0")}`,
        thai_word: candidate.word,
        frequency: candidate.count,
        book,
        review_status: "pending",
      }))
    );
  }

  const stats = VOCABULARY_BOOKS.map((book) => {
    const count = staged.filter((word) => word.book === book).length;
    return {
      name: book,
      count,
      target: VOCABULARY_BOOK_TARGET,
      remaining: Math.max(0, VOCABULARY_BOOK_TARGET - count),
    };
  });

  return { candidates: staged, stats, source: SOURCE_URL };
}

export { SOURCE_URL };

/**
 * Smart Intent Detector
 * Silently detects if a user prompt requires real-time / live internet grounding.
 * Zero UI friction - happens automatically in the background.
 */

// Temporal indicators (Hindi, Hinglish & English)
const TEMPORAL_PATTERNS = [
  /\b(today|now|current|latest|recent|yesterday|tomorrow|this week|this month|this year|live|breaking)\b/i,
  /(आज|अभी|ताज़ा|ताज़ा|कल|वर्तमान|लेटेस्ट|हाल ही|लाइव|ब्रेकिंग|इस हफ्ते|इस साल|ताजा)/i,
  /\b(aaj|abhi|taaza|taza|kal|latest|live|breaking|haali|recent)\b/i,
];

// Live event and domain triggers
const REALTIME_DOMAINS = [
  /\b(weather|temperature|forecast|mausam)\b/i,
  /(तापमान|मौसम)/i,
  /\b(news|samachar|khabar|pollution|air quality|aqi|grap|restrictions)\b/i,
  /(खबर|समाचार|प्रदूषण|वायु गुणवत्ता|प्रतिबंध|ग्रेप)/i,
  /\b(stock|share price|nifty|sensex|crypto|bitcoin|gold rate|silver price|petrol price|diesel price)\b/i,
  /(सोना|चांदी|पेट्रोल|डीजल|शेयर)/i,
  /\b(cricket|match|score|ipl|world cup|football|fifa|olympics)\b/i,
  /(मैच|स्कोर|क्रिकेट)/i,
  /\b(election|result|winner|chunav)\b/i,
  /(चुनाव|परिणाम|विजेता)/i,
  /\b(movie release|box office|review)\b/i,
  /(ट्रेलर|रिलीज|कमाई)/i,
  /\b(who is|koun hai|kya hai|tell me about|kon hai|kisne kiya|kaun hai)\b/i,
  /(कौन है|क्या है|के बारे में बताओ|किसने)/i,
  /\b(ceo of|president of|prime minister of|pm of|cm of|head of|mukhyamantri|pradhanmantri)\b/i,
  /(प्रधानमंत्री|मुख्यमंत्री)/i,
  /\b(summit|conference|cop\d*|g20|g7|brics|unfccc|host|venue)\b/i,
  /(सम्मेलन|शिखर सम्मेलन|बैठक|आयोजित|आयोजन|मेजबान|अगुवाई|जलवायु परिवर्तन)/i,
];

// Pure static / non-live patterns that don't need internet
const STATIC_PATTERNS = [
  /^(hi|hello|hey|namaste|नमस्ते|hola|kya haal|how are you|kese ho|kaise ho)\b/i,
  /\b(write a code|write a function|fix this bug|solve this equation|2\s*[\+\-\*\/]\s*2|poem|essay|कहानी|कविता|शायरी)\b/i,
];

export interface IntentDecision {
  requiresLiveSearch: boolean;
  cleanSearchQuery: string;
  reason?: string;
}

export function detectSearchIntent(userPrompt: string): IntentDecision {
  const text = userPrompt.trim();

  // Very short prompts rarely need search unless specific
  if (text.length < 3) {
    return { requiresLiveSearch: false, cleanSearchQuery: text };
  }

  // Check if it's purely conversational or static
  for (const staticPattern of STATIC_PATTERNS) {
    if (staticPattern.test(text) && text.length < 50) {
      return { requiresLiveSearch: false, cleanSearchQuery: text };
    }
  }

  // 1. Check for temporal keywords
  for (const pattern of TEMPORAL_PATTERNS) {
    if (pattern.test(text)) {
      return {
        requiresLiveSearch: true,
        cleanSearchQuery: cleanQueryForSearch(text),
        reason: 'Temporal trigger detected',
      };
    }
  }

  // 2. Check for real-time domains
  for (const pattern of REALTIME_DOMAINS) {
    if (pattern.test(text)) {
      return {
        requiresLiveSearch: true,
        cleanSearchQuery: cleanQueryForSearch(text),
        reason: 'Domain entity trigger detected',
      };
    }
  }

  // 3. Question words asking for factoid / world knowledge
  const factoidQuestion = /\b(what happened|when was|when did|where is|where will|who won|who is hosting|which country|kab hua|kya hua|kisne jeeta|kaha hai|kaha hoga|kahan)\b/i;
  const hindiFactoid = /(कहाँ|कहा|कब|किसने|किस देश|कौन सा देश|आयोजित|अध्यक्षता|अगुवाई)/i;
  if (factoidQuestion.test(text) || hindiFactoid.test(text)) {
    return {
      requiresLiveSearch: true,
      cleanSearchQuery: cleanQueryForSearch(text),
      reason: 'Factoid inquiry detected',
    };
  }

  // 4. Short general query (1-4 words) that starts with capital letters (Proper Nouns like "Narendra Modi", "Elon Musk", "Bitcoin", "Taj Mahal")
  const words = text.split(/\s+/);
  if (words.length >= 1 && words.length <= 5 && !/[.?!]$/.test(text)) {
    const hasProperNoun = words.some(w => /^[A-Z][a-z0-9]/.test(w));
    if (hasProperNoun) {
      return {
        requiresLiveSearch: true,
        cleanSearchQuery: cleanQueryForSearch(text),
        reason: 'Proper noun / Entity search detected',
      };
    }
  }

  return { requiresLiveSearch: false, cleanSearchQuery: text };
}

/**
 * Strips filler conversational phrasing to form a sharper search engine query
 */
function cleanQueryForSearch(rawQuery: string): string {
  // If query specifically mentions COP summit (e.g. COP31, COP30, COP29)
  const copMatch = rawQuery.match(/COP\s*\d+/i);
  if (copMatch) {
    return copMatch[0].toUpperCase().replace(/\s+/g, '');
  }

  let query = rawQuery
    .replace(/chhattisarh/gi, 'Chhattisgarh')
    .replace(/chhatisgarh/gi, 'Chhattisgarh');

  // If query asks for state CM (e.g. "bihar ke cm", "chhattisgarh ke cm")
  const cmMatch = query.match(/([a-zA-Z\u0900-\u097F]+)\s+(?:ke|ka|के|का)\s+(?:cm|chief minister|mukhyamantri|मुख्यमंत्री|सीएम)/i);
  if (cmMatch) {
    return `current Chief Minister of ${cmMatch[1]}`;
  }

  // If query asks for country PM / President
  const pmMatch = query.match(/([a-zA-Z\u0900-\u097F]+)\s+(?:ke|ka|के|का)\s+(?:pm|prime minister|pradhanmantri|प्रधानमंत्री|पीएम)/i);
  if (pmMatch) {
    return `current Prime Minister of ${pmMatch[1]}`;
  }

  let cleaned = query
    .replace(/^(bhai|bro|please|plz|can you tell me about|tell me about|tell me|who is the current|who is|who was|what is the current|what is|where is|when was)\s+/i, '')
    .replace(/^(मुझे बताओ|बताओ|कृपया|ज़रा|के बारे में बताओ|कौन है|क्या है)\s+/i, '')
    .replace(/\s+(kaun hai|koun hai|kon hai|kya hai|ke bare me batao|batao|bataiye|hai kya|hoga|kaisa hai|h)$/i, '')
    .replace(/\s+(कौन है|क्या है|के बारे में बताओ|बताओ|कैसा है)$/i, '')
    .replace(/[?!.]+$/, '')
    .trim();

  return cleaned || rawQuery;
}

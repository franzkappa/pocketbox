import { JSDOM } from 'jsdom';
import type {
  ExtractedNewsletterSignals,
  Folder,
  NewsletterClassificationResult,
  NewsletterRule,
  NewsletterSignalsInput,
} from './types';

const SHARED_PLATFORM_DOMAINS = new Set([
  'substack.com',
  'beehiiv.com',
  'mail.beehiiv.com',
  'ghost.io',
  'buttondown.email',
  'convertkit.com',
  'convertkit-mail.com',
  'convertkit-mail2.com',
  'ck.page',
  'list-manage.com',
  'mailchimp.com',
  'sendgrid.net',
  'customeriomail.com',
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'hotmail.com',
  'yahoo.com',
  'icloud.com',
  'me.com',
  'proton.me',
  'protonmail.com',
  'revue.co',
  'medium.com',
  'linkedin.com',
  'mailerlite.com',
  'brevo.com',
  'sendinblue.com',
]);

const EDITION_KEYWORDS_REGEX =
  /\b(morning|evening|daily|weekly|monthly|weekend|night|noon|midday|brief|briefing|newsletter|digest|edition|playbook|dispatch|bulletin|report|review|insider|update|roundup|journal|times|post|observer|press|wire|chronicle|gazette|tribune|herald|mail|today|mattina|sera|giorno|settimana|settimanale|quotidiano|rassegna|punto|bollettino|notizie|matin|soir|hebdo|quotidien|morgen|abend)\b/i;

const BOILERPLATE_HEADING_REGEX =
  /^(view\s+(this\s+)?(email|newsletter|message|post|issue)?\s*(in\s+(your\s+)?browser|online)|read\s+(online|in\s+browser|on\s+the\s+web|in\s+app)|open\s+in\s+browser|web\s+version|leggi\s+(nel\s+browser|online|sul\s+sito)|visualizza\s+(nel\s+browser|online)|versione\s+(web|online)|se\s+non\s+visualizzi|unsubscribe|disiscriviti|manage\s+preferences|forwarded\s+this\s+email|dear\s+reader|good\s+morning|good\s+evening|buongiorno|buonasera|ciao|hello|hi\s+there|welcome\b)/i;

const GENERIC_ALT_REGEX =
  /^(logo|image|img|banner|header|icon|photo|picture|avatar|profile|spacer|pixel|divider|button|arrow|facebook|twitter|x|instagram|linkedin|youtube|tiktok|substack|beehiiv|mailchimp|untitled|null|undefined)$/i;

const SUBJECT_IGNORE_PREFIX_REGEX =
  /^(re|fwd|fw|i|r|tr|aw|wg|rv|enc|test|newsletter|email|update|alert|breaking|new|importante|avviso)$/i;

const NEWSLETTER_FOLDER_COLORS = [
  '#6366F1', // Indigo
  '#8B5CF6', // Violet
  '#3B82F6', // Blue
  '#10B981', // Emerald
  '#EC4899', // Pink
  '#F59E0B', // Amber
  '#14B8A6', // Teal
  '#EF4444', // Rose
];

export function pickNewsletterColor(name: string): string {
  let hash = 0;
  const clean = name.trim().toLowerCase();
  for (let i = 0; i < clean.length; i++) {
    hash = (Math.imul(31, hash) + clean.charCodeAt(i)) | 0;
  }
  return NEWSLETTER_FOLDER_COLORS[Math.abs(hash) % NEWSLETTER_FOLDER_COLORS.length];
}

export function normalizeSeriesKey(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’`"_.\-/|,:;()[\]]+/g, ' ')
    .replace(/\b(the|la|il|lo|le|gli|i|un|una|le|les|el|los|las|der|die|das|newsletter)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getRootDomain(hostname: string): string {
  const clean = hostname.toLowerCase().replace(/^www\./, '').trim();
  if (!clean) return '';
  if (SHARED_PLATFORM_DOMAINS.has(clean)) return clean;

  const parts = clean.split('.');
  if (parts.length <= 2) return clean;

  // Check multi-part TLDs like .co.uk, .com.au, .org.uk
  const lastTwo = parts.slice(-2).join('.');
  if (/^(co|com|org|net|gov|edu|ac)\.[a-z]{2}$/.test(lastTwo) && parts.length >= 3) {
    return parts.slice(-3).join('.');
  }

  const candidateRoot = parts.slice(-2).join('.');
  if (SHARED_PLATFORM_DOMAINS.has(candidateRoot)) {
    // e.g. euobserver.substack.com -> keep subdomain if it's a publication subdomain, unless it's mail.beehiiv.com
    const sub = parts[0];
    if (!['mail', 'email', 'news', 'newsletter', 'mg', 'send', 'bounce', 'em', 'info'].includes(sub)) {
      return `${sub}.${candidateRoot}`;
    }
    return candidateRoot;
  }

  return candidateRoot;
}

function getDomainBrandStem(domain: string | null): string {
  if (!domain) return '';
  const lower = domain.toLowerCase();
  if (SHARED_PLATFORM_DOMAINS.has(lower)) return '';
  const parts = lower.split('.');
  if (parts.length >= 3 && SHARED_PLATFORM_DOMAINS.has(parts.slice(-2).join('.'))) {
    return parts[0].replace(/[^a-z0-9]/g, '');
  }
  return parts[0].replace(/[^a-z0-9]/g, '');
}

function isPureDateOrIssue(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (/^\d{1,4}([./-]\d{1,2}){1,2}$/.test(t)) return true;
  if (/^(#|no\.?|n\.?|issue|vol\.?|edizione|numero)\s*\d+$/i.test(t)) return true;
  const dateWords =
    /^(monday|tuesday|wednesday|thursday|friday|saturday|sunday|luned[iì]|marted[iì]|mercoled[iì]|gioved[iì]|venerd[iì]|sabato|domenica|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|january|february|march|april|may|june|july|august|september|october|november|december|gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec|\d{1,2}|\d{4}|[\s,./-])+$/i;
  return dateWords.test(t);
}

function stripDatesAndIssueNumbers(text: string): string {
  return text
    // Remove trailing or parenthesized dates like "- 23 Nov 2026", "(23/11/2026)", "| November 23, 2026"
    .replace(
      /\s*[-–—|•:,]?\s*\(?\b(?:\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{4}-\d{2}-\d{2}|(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|luned[iì]|marted[iì]|mercoled[iì]|gioved[iì]|venerd[iì]|sabato|domenica)?[\s,]*\d{1,2}\s+(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|gen(?:naio)?|feb(?:braio)?|mar(?:zo)?|apr(?:ile)?|mag(?:gio)?|giu(?:gno)?|lug(?:lio)?|ago(?:sto)?|set(?:tembre)?|ott(?:obre)?|nov(?:embre)?|dic(?:embre)?)(?:\s+\d{2,4})?|(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:,?\s+\d{2,4})?)\)?$/i,
      ''
    )
    // Remove trailing issue numbers like "#142", "- Issue 45", "n. 12"
    .replace(/\s*[-–—|•:,]?\s*(?:#\d+|\b(?:issue|no\.?|n\.?|numero|puntata|vol\.?)\s*#?\d+)\s*$/i, '')
    .trim();
}

function doesNameMatchEmailLocal(name: string, emailLocal: string | null): boolean {
  if (!name || !emailLocal) return false;
  const cleanLocal = emailLocal.toLowerCase().replace(/[^a-z]/g, '');
  if (cleanLocal.length < 3) return false;

  // Generic local-parts are NOT personal journalist names
  if (
    /^(news|newsletter|newsletters|info|hello|contact|mail|email|noreply|no-reply|editor|editorial|redazione|morning|evening|daily|weekly|digest|brief|briefing|team|press|substack|support|admin|updates|alerts)$/.test(
      emailLocal.toLowerCase().replace(/[^a-z-]/g, '')
    )
  ) {
    return false;
  }

  const tokens = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z]+/)
    .filter((t) => t.length >= 2);

  if (tokens.length < 2 || tokens.length > 3) return false;

  const [first, ...rest] = tokens;
  const last = rest[rest.length - 1];

  // Check patterns: firstlast, lastfirst, f.last (flast), first.l (firstl), or exact last/first match
  if (cleanLocal === `${first}${last}` || cleanLocal === `${last}${first}`) return true;
  if (cleanLocal === `${first[0]}${last}` || cleanLocal === `${first}${last[0]}`) return true;
  if (last.length >= 4 && cleanLocal === last) return true;
  if (first.length >= 4 && last.length >= 4 && (cleanLocal.includes(last) || cleanLocal.includes(first))) {
    // Only if name doesn't contain edition keywords
    if (!EDITION_KEYWORDS_REGEX.test(name)) return true;
  }

  return false;
}

function parseSenderIdentity(input: NewsletterSignalsInput): {
  senderEmail: string | null;
  senderLocal: string | null;
  senderDomain: string | null;
  isSharedPlatformDomain: boolean;
  rawSenderName: string | null;
} {
  let senderEmail = (input.senderEmail || '').trim().toLowerCase() || null;
  let rawSenderName = (input.senderName || '').trim() || null;

  const byline = (input.byline || '').trim();
  if (byline) {
    // Pattern: "Sender Name (email@domain.com)" or "Sender Name <email@domain.com>"
    const match =
      byline.match(/^(.+?)\s*\(([^()\s]+@[^()\s]+)\)$/) ||
      byline.match(/^(.+?)\s*<([^<>\s]+@[^<>\s]+)>$/);
    if (match) {
      if (!rawSenderName) rawSenderName = match[1].trim();
      if (!senderEmail) senderEmail = match[2].trim().toLowerCase();
    } else if (!senderEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(byline)) {
      senderEmail = byline.toLowerCase();
    } else if (!rawSenderName) {
      rawSenderName = byline;
    }
  }

  if (!rawSenderName && input.siteName) {
    const sn = input.siteName.trim();
    if (sn && !/^mail\.google\.com$/i.test(sn) && sn.toLowerCase() !== senderEmail) {
      rawSenderName = sn;
    }
  }

  // Strip surrounding quotes
  if (rawSenderName) {
    rawSenderName = rawSenderName.replace(/^["']+|["']+$/g, '').trim();
  }

  let senderLocal: string | null = null;
  let senderDomain: string | null = null;
  if (senderEmail && senderEmail.includes('@')) {
    const [local, rawDom] = senderEmail.split('@');
    senderLocal = local || null;
    senderDomain = getRootDomain(rawDom || '') || null;
  }

  const isSharedPlatformDomain = senderDomain
    ? SHARED_PLATFORM_DOMAINS.has(senderDomain)
    : false;

  return {
    senderEmail,
    senderLocal,
    senderDomain,
    isSharedPlatformDomain,
    rawSenderName,
  };
}

function decomposeSenderName(
  rawSenderName: string | null,
  senderLocal: string | null,
  senderDomain: string | null
): {
  senderPublicationName: string | null;
  senderAuthorName: string | null;
} {
  if (!rawSenderName) {
    return { senderPublicationName: null, senderAuthorName: null };
  }

  const brandStem = getDomainBrandStem(senderDomain);

  // Check if rawSenderName has explicit delimiters like:
  // "Alice Smith - EUobserver morning", "Alice Smith (EUobserver)", "Alice Smith from Charlie", "EUobserver - Morning"
  let parts: string[] = [];
  const parenMatch = rawSenderName.match(/^(.+?)\s*\(([^()]{2,45})\)$/);
  if (parenMatch) {
    parts = [parenMatch[1].trim(), parenMatch[2].trim()];
  } else {
    const splitMatch = rawSenderName.split(
      /\s+(?:[-–—|/·:]|from|at|via|by|di|da|per|chez)\s+/i
    );
    if (splitMatch.length === 2 && splitMatch[0].trim() && splitMatch[1].trim()) {
      parts = [splitMatch[0].trim(), splitMatch[1].trim()];
    }
  }

  if (parts.length === 2) {
    const [partA, partB] = parts;
    const aIsAuthor = doesNameMatchEmailLocal(partA, senderLocal);
    const bIsAuthor = doesNameMatchEmailLocal(partB, senderLocal);

    if (aIsAuthor && !bIsAuthor) {
      return { senderPublicationName: partB, senderAuthorName: partA };
    }
    if (bIsAuthor && !aIsAuthor) {
      return { senderPublicationName: partA, senderAuthorName: partB };
    }

    const scorePart = (p: string): number => {
      let s = 0;
      const clean = p.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (brandStem && clean.includes(brandStem)) s += 4;
      if (EDITION_KEYWORDS_REGEX.test(p)) s += 3;
      if (/^[A-Z0-9\s&.-]{3,}$/.test(p)) s += 1; // Acronym/Brand uppercase like POLITICO, AXIOS, FT
      return s;
    };

    const scoreA = scorePart(partA);
    const scoreB = scorePart(partB);

    // What if partA is the brand ("EUobserver") and partB is the edition ("morning" / "Morning Brief")?
    const aHasBrand = Boolean(brandStem && partA.toLowerCase().replace(/[^a-z0-9]/g, '').includes(brandStem));
    const bHasEdition = EDITION_KEYWORDS_REGEX.test(partB);
    if (aHasBrand && bHasEdition && partB.split(/\s+/).length <= 3) {
      // Combine if partB doesn't already contain partA
      if (!partB.toLowerCase().includes(partA.toLowerCase())) {
        return { senderPublicationName: `${partA} ${partB}`, senderAuthorName: null };
      }
      return { senderPublicationName: partB, senderAuthorName: null };
    }

    if (scoreB > scoreA) {
      return { senderPublicationName: partB, senderAuthorName: partA };
    }
    if (scoreA > scoreB) {
      return { senderPublicationName: partA, senderAuthorName: partB };
    }
  }

  // Single segment: check if it's purely a journalist's personal name matching their email local-part
  if (doesNameMatchEmailLocal(rawSenderName, senderLocal) && !EDITION_KEYWORDS_REGEX.test(rawSenderName)) {
    return {
      senderPublicationName: null,
      senderAuthorName: rawSenderName,
    };
  }

  return {
    senderPublicationName: rawSenderName,
    senderAuthorName: null,
  };
}

function extractSubjectSignals(
  rawTitle: string | null | undefined,
  senderDomain: string | null,
  senderPublicationName: string | null
): {
  subjectPrefix: string | null;
  subjectSeriesName: string | null;
} {
  if (!rawTitle) return { subjectPrefix: null, subjectSeriesName: null };

  // Clean trailing "- user@gmail.com - Gmail" if present
  const title = rawTitle
    .replace(/\s+-\s+[^-\s]+@[^-\s]+\s+-\s+Gmail$/i, '')
    .replace(/^(?:Fwd|Fw|Re|I|R|TR|AW|WG):\s*/i, '')
    .trim();

  if (!title) return { subjectPrefix: null, subjectSeriesName: null };

  let subjectPrefix: string | null = null;
  let subjectSeriesName: string | null = null;

  // 1. Bracketed prefix: "[EUobserver morning] Title..."
  const bracketMatch = title.match(/^\[([^\]]{2,42})\]\s*(.*)$/);
  if (bracketMatch) {
    const candidate = stripDatesAndIssueNumbers(bracketMatch[1].trim());
    if (
      candidate.length >= 2 &&
      !SUBJECT_IGNORE_PREFIX_REGEX.test(candidate) &&
      !isPureDateOrIssue(candidate)
    ) {
      subjectPrefix = candidate;
    }
  }

  // 2. Delimited prefix: "EUobserver morning: Title..." or "EUobserver morning — Title..."
  if (!subjectPrefix) {
    const delimMatch = title.match(/^([^:—–|•]{2,40}?)\s*(?::|—|–|\||•)\s+(.+)$/);
    if (delimMatch) {
      const candidate = stripDatesAndIssueNumbers(delimMatch[1].trim());
      const rest = delimMatch[2].trim();
      const words = candidate.split(/\s+/);
      const brandStem = getDomainBrandStem(senderDomain);
      const candidateClean = candidate.toLowerCase().replace(/[^a-z0-9]/g, '');

      const matchesBrand = Boolean(brandStem && candidateClean.includes(brandStem));
      const hasEditionWord = EDITION_KEYWORDS_REGEX.test(candidate);
      const matchesSenderPub =
        Boolean(senderPublicationName) &&
        (normalizeSeriesKey(candidate) === normalizeSeriesKey(senderPublicationName) ||
          normalizeSeriesKey(candidate).includes(normalizeSeriesKey(senderPublicationName)));

      // Accept delimited prefix if it's concise (<= 4 words) and either has brand/edition signal or rest is a date/issue or normal headline
      if (
        candidate.length >= 2 &&
        words.length <= 5 &&
        !SUBJECT_IGNORE_PREFIX_REGEX.test(candidate) &&
        !isPureDateOrIssue(candidate)
      ) {
        if (matchesBrand || hasEditionWord || matchesSenderPub || isPureDateOrIssue(rest) || words.length <= 3) {
          subjectPrefix = candidate;
        }
      }
    }
  }

  // 3. Entire subject is Series Name + Date/Issue (e.g. "EUobserver morning - 23 November 2026" or "EUobserver morning #142")
  const strippedFull = stripDatesAndIssueNumbers(title);
  if (
    strippedFull &&
    strippedFull.length >= 3 &&
    strippedFull.length <= 42 &&
    strippedFull.split(/\s+/).length <= 5 &&
    !isPureDateOrIssue(strippedFull)
  ) {
    if (strippedFull.length < title.length || EDITION_KEYWORDS_REGEX.test(strippedFull)) {
      subjectSeriesName = strippedFull;
    }
  }

  return { subjectPrefix, subjectSeriesName };
}

function extractHtmlSignals(
  html: string | null | undefined,
  url: string | null | undefined,
  rawTitle: string | null | undefined,
  senderDomain: string | null
): {
  masthead: string | null;
  logoAlt: string | null;
  footerSeries: string | null;
  utmCampaign: string | null;
  webHost: string | null;
} {
  let masthead: string | null = null;
  let logoAlt: string | null = null;
  let footerSeries: string | null = null;
  let utmCampaign: string | null = null;
  let webHost: string | null = null;

  if (url) {
    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.hostname !== 'mail.google.com') {
        webHost = getRootDomain(parsedUrl.hostname);
      }
      const utm = parsedUrl.searchParams.get('utm_campaign');
      if (utm) {
        utmCampaign = cleanUtmCampaign(utm);
      }
    } catch {
      // ignore
    }
  }

  if (!html || !html.trim()) {
    return { masthead, logoAlt, footerSeries, utmCampaign, webHost };
  }

  try {
    const dom = new JSDOM(html);
    const doc = dom.window.document;
    const brandStem = getDomainBrandStem(senderDomain || webHost);

    // 1. Check first 6 images for a clean banner/masthead logo alt text
    const imgs = Array.from(doc.querySelectorAll('img')).slice(0, 6);
    for (const img of imgs) {
      const rawAlt = (img.getAttribute('alt') || img.getAttribute('title') || '')
        .replace(/\s+/g, ' ')
        .trim();
      if (!rawAlt || rawAlt.length < 2 || rawAlt.length > 45) continue;
      if (/^https?:\/\/|\.(png|jpe?g|gif|svg|webp)$/i.test(rawAlt)) continue;

      const cleanedAlt = rawAlt
        .replace(/\s+(?:logo|banner|header|masthead|icon)$/i, '')
        .replace(/^(?:logo|banner|header)\s+(?:of|di|de)?\s*/i, '')
        .trim();

      if (
        cleanedAlt.length >= 2 &&
        cleanedAlt.length <= 42 &&
        !GENERIC_ALT_REGEX.test(cleanedAlt) &&
        !BOILERPLATE_HEADING_REGEX.test(cleanedAlt) &&
        !isPureDateOrIssue(cleanedAlt)
      ) {
        logoAlt = cleanedAlt;
        break;
      }
    }

    // 2. Check top headings / early text blocks for masthead title
    const normalizedSubject = normalizeSeriesKey(rawTitle);
    const candidateEls = Array.from(
      doc.querySelectorAll('h1, h2, h3, header, td, div, p, span')
    ).slice(0, 45);

    const seenTexts = new Set<string>();
    for (const el of candidateEls) {
      // Only inspect elements that don't wrap lots of other block elements
      if (el.querySelectorAll('p, h1, h2, h3, table, ul, ol').length > 1) continue;
      const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (!text || text.length < 3 || text.length > 45) continue;
      if (seenTexts.has(text.toLowerCase())) continue;
      seenTexts.add(text.toLowerCase());

      if (BOILERPLATE_HEADING_REGEX.test(text) || isPureDateOrIssue(text)) continue;

      const stripped = stripDatesAndIssueNumbers(text);
      if (!stripped || stripped.length < 3 || stripped.length > 42) continue;

      const words = stripped.split(/\s+/);
      if (words.length > 5) continue;

      const isHeadingTag = /^H[123]$/i.test(el.tagName);
      const cleanAlpha = stripped.toLowerCase().replace(/[^a-z0-9]/g, '');
      const hasBrand = Boolean(brandStem && cleanAlpha.includes(brandStem));
      const hasEdition = EDITION_KEYWORDS_REGEX.test(stripped);

      // Avoid picking the issue's unique article headline as masthead unless it has brand/edition or is short series title
      const isSameAsLongSubject =
        normalizedSubject.length > 25 &&
        normalizeSeriesKey(stripped) === normalizedSubject &&
        !hasBrand &&
        !hasEdition;

      if (isSameAsLongSubject) continue;

      if (hasBrand || hasEdition || isHeadingTag) {
        masthead = stripped;
        break;
      }
    }

    // 3. Extract footer subscription series attribution
    const fullText = (doc.body?.textContent || '').replace(/\s+/g, ' ').trim();
    const tailText = fullText.slice(Math.max(0, fullText.length - 2500));
    const footerPatterns = [
      /you(?:'re|\s+are)\s+receiving\s+(?:this\s+email\s+from\s+|the\s+)?([A-Z0-9][A-Za-z0-9À-ÿ\s'’&-]{2,38}?)\s+because\b/i,
      /you\s+received\s+this\s+(?:email|newsletter|message)\s+because\s+you\s+(?:are\s+)?subscribed\s+to\s+([A-Z0-9][A-Za-z0-9À-ÿ\s'’&-]{2,38}?)(?:[.,!]|$)/i,
      /thank(?:s|\s+you)\s+for\s+reading\s+([A-Z0-9][A-Za-z0-9À-ÿ\s'’&-]{2,38}?)(?:[.,!]|$)/i,
      /this\s+(?:edition|issue)\s+of\s+([A-Z0-9][A-Za-z0-9À-ÿ\s'’&-]{2,38}?)\s+was\b/i,
      /(?:stai\s+ricevendo|hai\s+ricevuto)\s+([A-Z0-9][A-Za-z0-9À-ÿ\s'’&-]{2,38}?)\s+perch[eé]\b/i,
      /iscritt[oa]\s+(?:a|alla\s+newsletter\s+di|alla\s+newsletter)\s+([A-Z0-9][A-Za-z0-9À-ÿ\s'’&-]{2,38}?)(?:[.,!]|$)/i,
      /grazie\s+per\s+aver\s+letto\s+([A-Z0-9][A-Za-z0-9À-ÿ\s'’&-]{2,38}?)(?:[.,!]|$)/i,
    ];

    for (const rx of footerPatterns) {
      const m = tailText.match(rx);
      if (m && m[1]) {
        const candidate = m[1]
          .replace(/\s+(?:newsletter|mailing\s+list|email)$/i, '')
          .trim();
        if (
          candidate.length >= 2 &&
          candidate.length <= 40 &&
          candidate.split(/\s+/).length <= 5 &&
          !BOILERPLATE_HEADING_REGEX.test(candidate)
        ) {
          footerSeries = candidate;
          break;
        }
      }
    }

    // 4. Check links for utm_campaign if not already found
    if (!utmCampaign) {
      const campaignCounts = new Map<string, number>();
      const anchors = Array.from(doc.querySelectorAll('a[href]')).slice(0, 40);
      for (const a of anchors) {
        const href = a.getAttribute('href') || '';
        try {
          const u = new URL(href, 'https://example.com');
          const rawUtm = u.searchParams.get('utm_campaign');
          if (rawUtm) {
            const cleaned = cleanUtmCampaign(rawUtm);
            if (cleaned) {
              campaignCounts.set(cleaned, (campaignCounts.get(cleaned) || 0) + 1);
            }
          }
          if (!webHost && /^https?:\/\//i.test(href)) {
            const h = getRootDomain(u.hostname);
            if (
              h &&
              !SHARED_PLATFORM_DOMAINS.has(h) &&
              !['google.com', 'facebook.com', 'twitter.com', 'x.com', 'instagram.com', 'youtube.com'].includes(h)
            ) {
              webHost = h;
            }
          }
        } catch {
          // ignore
        }
      }

      let bestUtm: string | null = null;
      let bestCount = 0;
      for (const [camp, count] of campaignCounts.entries()) {
        if (count > bestCount) {
          bestCount = count;
          bestUtm = camp;
        }
      }
      if (bestUtm) utmCampaign = bestUtm;
    }
  } catch {
    // ignore DOM parse errors
  }

  return { masthead, logoAlt, footerSeries, utmCampaign, webHost };
}

function cleanUtmCampaign(raw: string): string | null {
  const cleaned = raw
    .trim()
    .toLowerCase()
    // Strip dates like 20261123, 2026-11-23, 23_11_2026
    .replace(/(?:^|[-_])(?:\d{8}|\d{4}[-_]\d{2}[-_]\d{2}|\d{2}[-_]\d{2}[-_]\d{4})(?:$|[-_])/g, ' ')
    // Strip trailing numbers / issue IDs
    .replace(/[-_]\d{1,5}$/, '')
    .replace(/[-_+]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned || cleaned.length < 3 || cleaned.length > 42 || /^\d+$/.test(cleaned)) {
    return null;
  }
  return cleaned;
}

export function extractNewsletterSignals(
  input: NewsletterSignalsInput
): ExtractedNewsletterSignals {
  const {
    senderEmail,
    senderLocal,
    senderDomain,
    isSharedPlatformDomain,
    rawSenderName,
  } = parseSenderIdentity(input);

  const { senderPublicationName, senderAuthorName } = decomposeSenderName(
    rawSenderName,
    senderLocal,
    senderDomain
  );

  const { subjectPrefix, subjectSeriesName } = extractSubjectSignals(
    input.title,
    senderDomain,
    senderPublicationName
  );

  const { masthead, logoAlt, footerSeries, utmCampaign, webHost } = extractHtmlSignals(
    input.html,
    input.url,
    input.title,
    senderDomain
  );

  return {
    senderEmail,
    senderLocal,
    senderDomain,
    isSharedPlatformDomain,
    rawSenderName,
    senderPublicationName,
    senderAuthorName,
    subjectPrefix,
    subjectSeriesName,
    masthead,
    logoAlt,
    footerSeries,
    utmCampaign,
    webHost,
  };
}

/**
 * Synthesizes the cleanest canonical newsletter folder name from the extracted multi-indicator signals.
 */
export function deduceNewsletterSeriesName(signals: ExtractedNewsletterSignals): string {
  const brandStem = getDomainBrandStem(signals.senderDomain || signals.webHost);

  const pub = signals.senderPublicationName?.trim() || null;
  const prefix = signals.subjectPrefix?.trim() || signals.subjectSeriesName?.trim() || null;
  const headerSignal =
    signals.masthead?.trim() || signals.logoAlt?.trim() || signals.footerSeries?.trim() || null;

  // Helper to check if a candidate is a full brand+edition name (e.g. "EUobserver morning")
  const hasBothBrandAndEdition = (str: string | null): boolean => {
    if (!str) return false;
    const clean = str.toLowerCase().replace(/[^a-z0-9]/g, '');
    return Boolean(brandStem && clean.includes(brandStem) && EDITION_KEYWORDS_REGEX.test(str));
  };

  if (hasBothBrandAndEdition(pub)) return pub!;
  if (hasBothBrandAndEdition(prefix)) return prefix!;
  if (hasBothBrandAndEdition(headerSignal)) return headerSignal!;

  // If pub is just the brand (e.g. "EUobserver") and prefix/headerSignal is the edition (e.g. "morning" or "EUobserver morning"):
  if (pub && prefix) {
    const normPub = normalizeSeriesKey(pub);
    const normPre = normalizeSeriesKey(prefix);
    if (normPre.includes(normPub)) {
      return prefix;
    }
    if (normPub.includes(normPre)) {
      return pub;
    }
    // If pub is short brand ("EUobserver") and prefix is short edition ("Morning" / "Morning Brief")
    if (pub.split(/\s+/).length <= 2 && prefix.split(/\s+/).length <= 2 && EDITION_KEYWORDS_REGEX.test(prefix)) {
      return `${pub} ${prefix}`;
    }
  }

  if (pub && headerSignal) {
    const normPub = normalizeSeriesKey(pub);
    const normHead = normalizeSeriesKey(headerSignal);
    if (normHead.includes(normPub) && headerSignal.split(/\s+/).length <= 5) {
      return headerSignal;
    }
  }

  // If sender was a personal journalist name (so pub is null) or pub lacks edition info while prefix/header has it:
  if (!pub && prefix) return prefix;
  if (!pub && headerSignal) return headerSignal;

  // If pub exists, prefer it unless prefix is clearly a more specific series title from the same publisher
  if (pub) {
    if (prefix && EDITION_KEYWORDS_REGEX.test(prefix) && !EDITION_KEYWORDS_REGEX.test(pub)) {
      const cleanPre = prefix.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (brandStem && cleanPre.includes(brandStem)) {
        return prefix;
      }
      if (pub.split(/\s+/).length <= 2 && prefix.split(/\s+/).length <= 2) {
        return `${pub} ${prefix}`;
      }
      return prefix;
    }
    return pub;
  }

  if (signals.footerSeries) return signals.footerSeries;

  // Fallback to local-part on Substack (e.g. "euobserver@substack.com") or publisher domain
  if (signals.isSharedPlatformDomain && signals.senderLocal) {
    return formatSlugAsTitle(signals.senderLocal);
  }
  if (signals.senderDomain && !signals.isSharedPlatformDomain) {
    const stem = signals.senderDomain.split('.')[0];
    if (
      signals.senderLocal &&
      EDITION_KEYWORDS_REGEX.test(signals.senderLocal) &&
      !signals.senderLocal.toLowerCase().includes(stem.toLowerCase())
    ) {
      return `${formatSlugAsTitle(stem)} ${formatSlugAsTitle(signals.senderLocal)}`;
    }
    return formatSlugAsTitle(stem);
  }
  if (signals.rawSenderName) return signals.rawSenderName;

  return 'Newsletter';
}

function formatSlugAsTitle(slug: string): string {
  return slug
    .replace(/[-_.]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function seriesNamesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const keyA = normalizeSeriesKey(a);
  const keyB = normalizeSeriesKey(b);
  if (!keyA || !keyB) return false;
  return keyA === keyB;
}

function seriesNamesConflict(
  candidateSeries: string | null | undefined,
  folderName: string,
  senderDomain: string | null
): boolean {
  const candKey = normalizeSeriesKey(candidateSeries);
  const folderKey = normalizeSeriesKey(folderName);
  if (!candKey || !folderKey) return false;
  if (candKey === folderKey) return false;

  // Strip the shared publisher brand stem (e.g. "euobserver") to compare the edition part ("morning" vs "weekly")
  const brandStem = getDomainBrandStem(senderDomain);
  const stripBrand = (k: string) =>
    brandStem ? k.replace(new RegExp(`\\b${brandStem}\\b`, 'g'), '').replace(/\s+/g, ' ').trim() : k;

  const candEdition = stripBrand(candKey);
  const folderEdition = stripBrand(folderKey);

  // If both have distinct non-empty edition words (e.g. "morning" vs "weekly"), they conflict!
  if (candEdition && folderEdition && candEdition !== folderEdition) {
    return true;
  }

  // If neither shares any significant word (>2 chars) with the other, they conflict
  const candTokens = candKey.split(' ').filter((w) => w.length > 2);
  const folderTokens = new Set(folderKey.split(' ').filter((w) => w.length > 2));
  const overlap = candTokens.filter((w) => folderTokens.has(w));
  if (overlap.length === 0) return true;

  return false;
}

/**
 * Matches incoming newsletter signals against existing newsletter folders and historical rules.
 */
export function classifyNewsletterAgainstFolders(
  input: NewsletterSignalsInput,
  newsletterFolders: Folder[],
  rules: NewsletterRule[]
): NewsletterClassificationResult {
  const signals = extractNewsletterSignals(input);
  const deducedName = deduceNewsletterSeriesName(signals);

  // Explicit series indicators for conflict detection when multiple newsletters come from the same sender/domain
  const explicitSeriesIndicators = [
    deducedName,
    signals.subjectPrefix,
    signals.subjectSeriesName,
    signals.masthead,
    signals.logoAlt,
    signals.footerSeries,
    signals.senderPublicationName,
  ].filter(Boolean) as string[];

  let bestFolder: Folder | null = null;
  let bestScore = 0;

  for (const folder of newsletterFolders) {
    let score = 0;
    const folderRules = rules.filter((r) => r.folder_id === folder.id);

    // 1. Direct match between deduced series name (or any strong series indicator) and folder.name
    if (seriesNamesMatch(deducedName, folder.name)) {
      score += 100;
    } else if (
      seriesNamesMatch(signals.subjectPrefix, folder.name) ||
      seriesNamesMatch(signals.subjectSeriesName, folder.name) ||
      seriesNamesMatch(signals.masthead, folder.name) ||
      seriesNamesMatch(signals.logoAlt, folder.name) ||
      seriesNamesMatch(signals.footerSeries, folder.name) ||
      seriesNamesMatch(signals.senderPublicationName, folder.name)
    ) {
      score += 90;
    }

    // 2. Compare against stored historical rules for this folder (handles user renames & journalist changes)
    let ruleBoost = 0;
    for (const rule of folderRules) {
      let rScore = 0;

      // Same publisher domain
      if (
        signals.senderDomain &&
        rule.sender_domain &&
        signals.senderDomain === rule.sender_domain &&
        !signals.isSharedPlatformDomain
      ) {
        rScore += 22;
      }

      // Same web host
      if (
        signals.webHost &&
        rule.web_host &&
        signals.webHost === rule.web_host &&
        !SHARED_PLATFORM_DOMAINS.has(signals.webHost)
      ) {
        rScore += 18;
      }

      // Same subject prefix
      if (
        signals.subjectPrefix &&
        rule.subject_prefix &&
        seriesNamesMatch(signals.subjectPrefix, rule.subject_prefix)
      ) {
        rScore += 55;
      }

      // Same HTML masthead / logo
      if (
        (signals.masthead || signals.logoAlt) &&
        rule.masthead &&
        (seriesNamesMatch(signals.masthead, rule.masthead) ||
          seriesNamesMatch(signals.logoAlt, rule.masthead))
      ) {
        rScore += 55;
      }

      // Same UTM campaign series
      if (
        signals.utmCampaign &&
        rule.utm_campaign &&
        seriesNamesMatch(signals.utmCampaign, rule.utm_campaign)
      ) {
        rScore += 45;
      }

      // Same sender publication name
      if (
        signals.senderPublicationName &&
        rule.sender_name &&
        seriesNamesMatch(signals.senderPublicationName, rule.sender_name)
      ) {
        rScore += 50;
      }

      // Same exact sender email
      if (signals.senderEmail && rule.sender_email && signals.senderEmail === rule.sender_email) {
        rScore += 35;
      }

      if (rScore > ruleBoost) {
        ruleBoost = rScore;
      }
    }

    score += ruleBoost;

    // 3. Conflict check: if the email has an explicit series indicator (e.g. "EUobserver Weekly")
    // that conflicts with this folder ("EUobserver morning") AND doesn't match any learned rule's series indicator,
    // penalize heavily so two different newsletters from the same sender/domain are never merged!
    const hasLearnedSeriesMatch = folderRules.some(
      (r) =>
        (signals.subjectPrefix && seriesNamesMatch(signals.subjectPrefix, r.subject_prefix)) ||
        (signals.masthead && seriesNamesMatch(signals.masthead, r.masthead)) ||
        (signals.senderPublicationName && seriesNamesMatch(signals.senderPublicationName, r.sender_name))
    );

    if (!hasLearnedSeriesMatch && score < 90) {
      const primaryIndicator =
        signals.subjectPrefix ||
        signals.masthead ||
        signals.logoAlt ||
        signals.senderPublicationName ||
        deducedName;

      if (
        primaryIndicator &&
        seriesNamesConflict(primaryIndicator, folder.name, signals.senderDomain)
      ) {
        score -= 70;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestFolder = folder;
    }
  }

  // Threshold for matching an existing newsletter folder is 55 points
  const matchedFolder = bestScore >= 55 ? bestFolder : null;
  const suggestedFolderName = matchedFolder ? matchedFolder.name : deducedName;
  const suggestedColor = matchedFolder
    ? matchedFolder.color
    : pickNewsletterColor(suggestedFolderName);

  return {
    matchedFolder,
    suggestedFolderName,
    suggestedColor,
    isNewFolder: !matchedFolder,
    confidence: Math.min(100, Math.max(0, bestScore)),
    signals,
  };
}

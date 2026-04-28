// Supabase Edge Function: sos-lookup
// Deno runtime — scrapes MA and RI Secretary of State portals server-side
// to avoid CORS restrictions that would block browser-side fetches.
//
// MA portal: https://corp.sec.state.ma.us/corpweb/CorpSearch/CorpSearch.aspx
// RI portal: https://business.sos.ri.gov/corpweb/corpsearch/corpsearch.aspx
//
// Both use ASP.NET WebForms — identical hidden-field flow:
//   1. GET search page → extract __VIEWSTATE, __EVENTVALIDATION
//   2. POST with business name → parse results table
//   3. GET detail page → parse entity fields

import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.43/deno-dom-wasm.ts";

// ─── CORS ────────────────────────────────────────────────────────────────────

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Types ───────────────────────────────────────────────────────────────────

interface SosResult {
  entity_type: string | null;
  formation_date: string | null;
  status: string | null;
  registered_agent: string | null;
  officers: { name: string; title: string }[];
  principal_address: string | null;
  dba_names: string[];
  naics_code: string | null;
  matched_name: string | null;
  source_url: string | null;
  state: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

/** Extract a hidden ASP.NET form field value from HTML text. */
function extractHidden(html: string, name: string): string {
  const re = new RegExp(`<input[^>]+name="${name.replace(/\$/g, "\\$")}"[^>]+value="([^"]*)"`, "i");
  const m = html.match(re);
  return m ? m[1] : "";
}

/** Text content of a DOM element, trimmed. */
function text(el: Element | null): string {
  return el?.textContent?.trim() ?? "";
}

// ─── MA Scraper ───────────────────────────────────────────────────────────────

const MA_BASE = "https://corp.sec.state.ma.us/corpweb/CorpSearch";
const MA_SEARCH = `${MA_BASE}/CorpSearch.aspx`;

async function scrapeMA(name: string, city: string | null): Promise<SosResult | null> {
  // Step 1: GET search page to extract hidden fields
  const getRes = await fetch(MA_SEARCH, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; SOS-Lookup/1.0)" },
  });
  if (!getRes.ok) throw new Error(`MA GET failed: ${getRes.status}`);
  const getHtml = await getRes.text();
  const cookies = getRes.headers.get("set-cookie") ?? "";

  const viewState = extractHidden(getHtml, "__VIEWSTATE");
  const viewStateGen = extractHidden(getHtml, "__VIEWSTATEGENERATOR");
  const eventVal = extractHidden(getHtml, "__EVENTVALIDATION");

  // Step 2: POST search form
  const formData = new URLSearchParams({
    "__VIEWSTATE": viewState,
    "__VIEWSTATEGENERATOR": viewStateGen,
    "__EVENTVALIDATION": eventVal,
    "ctl00$MainContent$txtEntityName": name,
    "ctl00$MainContent$ddBeginsWithEntityName": "BeginsWith",
    "ctl00$MainContent$btnSearch": "Search+Corporations",
  });

  const postRes = await fetch(MA_SEARCH, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Mozilla/5.0 (compatible; SOS-Lookup/1.0)",
      "Referer": MA_SEARCH,
      "Cookie": cookies,
    },
    body: formData.toString(),
  });
  if (!postRes.ok) throw new Error(`MA POST failed: ${postRes.status}`);
  const resultsHtml = await postRes.text();
  const resultCookies = postRes.headers.get("set-cookie") ?? cookies;

  // Step 3: parse results table
  const parser = new DOMParser();
  const doc = parser.parseFromString(resultsHtml, "text/html");
  if (!doc) return null;

  // Results table: id="ctl00_MainContent_SearchControl_grdSearchResultsEntity"
  const table = doc.getElementById("ctl00_MainContent_SearchControl_grdSearchResultsEntity");
  if (!table) return null;

  const rows = Array.from(table.querySelectorAll("tr")).slice(1); // skip header
  if (rows.length === 0) return null;

  // Score rows by name (and city if available via Address column)
  const targetName = normalize(name);
  const targetCity = city ? normalize(city) : null;
  const STOP_WORDS = new Set(["the", "a", "an", "of", "and", "llc", "inc", "corp", "ltd", "co"]);

  interface Candidate { el: Element; nameScore: number; cityScore: number; link: string }
  const candidates: Candidate[] = [];

  for (const row of rows) {
    const cells = row.querySelectorAll("td");
    if (cells.length < 2) continue;

    const nameCell = cells[0];
    const addrCell = cells[cells.length - 1]; // last column is address
    const link = nameCell.querySelector("a")?.getAttribute("href") ?? "";
    if (!link) continue;

    const rowName = normalize(text(nameCell));
    const rowAddr = normalize(text(addrCell));

    // Name score
    let nameScore = 0;
    if (rowName === targetName) nameScore = 3;
    else if (rowName.includes(targetName)) nameScore = 2;
    else if (targetName.includes(rowName) && rowName.length > 3) nameScore = 2;
    else {
      const tokens = targetName.split(" ").filter(w => w.length > 2 && !STOP_WORDS.has(w));
      const overlap = tokens.filter(w => rowName.includes(w)).length;
      if (overlap > 0) nameScore = overlap;
    }

    // City score — check address cell for city name
    const cityScore = (targetCity && rowAddr.includes(targetCity)) ? 3 : 0;

    if (cityScore > 0 || nameScore > 0) {
      candidates.push({ el: row, nameScore, cityScore, link });
    }
  }

  if (candidates.length === 0) return null;

  const minScore = targetCity ? 3 : 1;
  const best = candidates
    .filter(c => c.nameScore + c.cityScore >= minScore)
    .sort((a, b) => (b.nameScore + b.cityScore) - (a.nameScore + a.cityScore))[0];

  if (!best) return null;

  // Step 4: GET detail page
  const detailUrl = best.link.startsWith("http")
    ? best.link
    : `${MA_BASE}/${best.link.replace(/^\.?\//, "")}`;

  const detailRes = await fetch(detailUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; SOS-Lookup/1.0)",
      "Referer": MA_SEARCH,
      "Cookie": resultCookies,
    },
  });
  if (!detailRes.ok) return null;
  const detailHtml = await detailRes.text();
  const detailDoc = parser.parseFromString(detailHtml, "text/html");
  if (!detailDoc) return null;

  return parseMADetail(detailDoc, detailUrl, best.el);
}

function parseMADetail(doc: Document, sourceUrl: string, resultRow: Element): SosResult {
  /** Find a label-value pair in the MA detail page — labels are in <th> or <td> with bold text */
  function findValue(labelText: string): string | null {
    const allTh = Array.from(doc.querySelectorAll("th, td.label, td b, td strong"));
    for (const el of allTh) {
      if (el.textContent?.trim().toLowerCase().includes(labelText.toLowerCase())) {
        // value is in next sibling td
        const next = el.closest("td")?.nextElementSibling ?? el.nextElementSibling;
        if (next) return text(next as Element) || null;
      }
    }
    return null;
  }

  // Entity name from the result row first cell
  const cells = resultRow.querySelectorAll("td");
  const matchedName = text(cells[0]);

  // Entity type — typically shown as heading or in a field
  const entityType =
    findValue("entity type") ??
    findValue("type of organization") ??
    findValue("type") ??
    null;

  // Status — look for "status" label or check for dissolution date
  let status = findValue("status") ?? null;
  if (!status) {
    const dissolvedDate = findValue("date of voluntary dissolution") ?? findValue("dissolution");
    status = dissolvedDate ? "Dissolved" : "Active";
  }

  // Formation date
  const formationDate =
    findValue("date of organization") ??
    findValue("date of qualification") ??
    findValue("date of registration") ??
    null;

  // Principal office address
  const principalAddress =
    findValue("principal office") ??
    findValue("principal address") ??
    findValue("address") ??
    null;

  // Registered agent
  const registeredAgentName = findValue("resident agent") ?? findValue("registered agent") ?? null;
  const registeredAgentAddr = findValue("resident agent address") ?? null;
  const registeredAgent = [registeredAgentName, registeredAgentAddr].filter(Boolean).join(", ") || null;

  // Officers — in a table inside the detail page
  const officers: { name: string; title: string }[] = [];
  const officerTable = Array.from(doc.querySelectorAll("table")).find(t => {
    const headers = Array.from(t.querySelectorAll("th, td")).map(c => text(c as Element).toLowerCase());
    return headers.some(h => h.includes("title")) && headers.some(h => h.includes("name") || h.includes("individual"));
  });

  if (officerTable) {
    const oRows = Array.from(officerTable.querySelectorAll("tr")).slice(1);
    for (const r of oRows) {
      const ocells = r.querySelectorAll("td");
      if (ocells.length >= 2) {
        const title = text(ocells[0] as Element);
        const oName = text(ocells[1] as Element);
        if (oName && title) officers.push({ name: oName, title });
      }
    }
  }

  return {
    entity_type: entityType,
    formation_date: formationDate,
    status,
    registered_agent: registeredAgent,
    officers,
    principal_address: principalAddress,
    dba_names: [],
    naics_code: null, // MA doesn't expose NAICS on detail page
    matched_name: matchedName || null,
    source_url: sourceUrl,
    state: "MA",
  };
}

// ─── RI Scraper ───────────────────────────────────────────────────────────────

const RI_BASE = "https://business.sos.ri.gov/corpweb/corpsearch";
const RI_SEARCH = `${RI_BASE}/corpsearch.aspx`;

async function scrapeRI(name: string, city: string | null): Promise<SosResult | null> {
  // Step 1: GET search page
  const getRes = await fetch(RI_SEARCH, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; SOS-Lookup/1.0)" },
  });
  if (!getRes.ok) throw new Error(`RI GET failed: ${getRes.status}`);
  const getHtml = await getRes.text();
  const cookies = getRes.headers.get("set-cookie") ?? "";

  const viewState = extractHidden(getHtml, "__VIEWSTATE");
  const viewStateGen = extractHidden(getHtml, "__VIEWSTATEGENERATOR");
  const eventVal = extractHidden(getHtml, "__EVENTVALIDATION");

  // Step 2: POST search
  const formData = new URLSearchParams({
    "__VIEWSTATE": viewState,
    "__VIEWSTATEGENERATOR": viewStateGen,
    "__EVENTVALIDATION": eventVal,
    "ctl00$MainContent$txtEntityName": name,
    "ctl00$MainContent$ddBeginsWithEntityName": "BeginsWith",
    "ctl00$MainContent$btnSearch": "Search",
  });

  const postRes = await fetch(RI_SEARCH, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Mozilla/5.0 (compatible; SOS-Lookup/1.0)",
      "Referer": RI_SEARCH,
      "Cookie": cookies,
    },
    body: formData.toString(),
  });
  if (!postRes.ok) throw new Error(`RI POST failed: ${postRes.status}`);
  const resultsHtml = await postRes.text();
  const resultCookies = postRes.headers.get("set-cookie") ?? cookies;

  // Step 3: parse results table (same structure as MA)
  const parser = new DOMParser();
  const doc = parser.parseFromString(resultsHtml, "text/html");
  if (!doc) return null;

  const table = doc.getElementById("ctl00_MainContent_SearchControl_grdSearchResultsEntity");
  if (!table) return null;

  const rows = Array.from(table.querySelectorAll("tr")).slice(1);
  if (rows.length === 0) return null;

  const targetName = normalize(name);
  const targetCity = city ? normalize(city) : null;
  const STOP_WORDS = new Set(["the", "a", "an", "of", "and", "llc", "inc", "corp", "ltd", "co"]);

  interface Candidate { el: Element; score: number; link: string }
  const candidates: Candidate[] = [];

  for (const row of rows) {
    const cells = row.querySelectorAll("td");
    if (cells.length < 2) continue;

    const nameCell = cells[0];
    const addrCell = cells[cells.length - 1];
    const link = nameCell.querySelector("a")?.getAttribute("href") ?? "";
    if (!link) continue;

    const rowName = normalize(text(nameCell));
    const rowAddr = normalize(text(addrCell));

    let nameScore = 0;
    if (rowName === targetName) nameScore = 3;
    else if (rowName.includes(targetName)) nameScore = 2;
    else if (targetName.includes(rowName) && rowName.length > 3) nameScore = 2;
    else {
      const tokens = targetName.split(" ").filter(w => w.length > 2 && !STOP_WORDS.has(w));
      const overlap = tokens.filter(w => rowName.includes(w)).length;
      if (overlap > 0) nameScore = overlap;
    }

    const cityScore = (targetCity && rowAddr.includes(targetCity)) ? 3 : 0;
    const totalScore = nameScore + cityScore;

    if (totalScore > 0) candidates.push({ el: row, score: totalScore, link });
  }

  if (candidates.length === 0) return null;

  const minScore = targetCity ? 3 : 1;
  const best = candidates
    .filter(c => c.score >= minScore)
    .sort((a, b) => b.score - a.score)[0];

  if (!best) return null;

  // RI uses FEIN-based URLs: CorpSummary.aspx?FEIN=000688755&SEARCH_TYPE=1
  const detailUrl = best.link.startsWith("http")
    ? best.link
    : `${RI_BASE}/${best.link.replace(/^\.?\//, "")}`;

  const detailRes = await fetch(detailUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; SOS-Lookup/1.0)",
      "Referer": RI_SEARCH,
      "Cookie": resultCookies,
    },
  });
  if (!detailRes.ok) return null;
  const detailHtml = await detailRes.text();
  const detailDoc = parser.parseFromString(detailHtml, "text/html");
  if (!detailDoc) return null;

  return parseRIDetail(detailDoc, detailUrl, best.el);
}

function parseRIDetail(doc: Document, sourceUrl: string, resultRow: Element): SosResult {
  function findValue(labelText: string): string | null {
    const allLabels = Array.from(doc.querySelectorAll("th, td.label, td b, td strong, span"));
    for (const el of allLabels) {
      if (el.textContent?.trim().toLowerCase().includes(labelText.toLowerCase())) {
        const next = el.closest("td")?.nextElementSibling ?? el.nextElementSibling;
        if (next) return text(next as Element) || null;
      }
    }
    return null;
  }

  const cells = resultRow.querySelectorAll("td");
  const matchedName = text(cells[0]);

  const entityType =
    findValue("entity type") ?? findValue("type of organization") ?? null;

  const status = findValue("status") ?? "Active";

  const formationDate =
    findValue("date of organization") ??
    findValue("date of qualification") ??
    findValue("date of registration") ??
    null;

  const registeredAgentName = findValue("resident agent") ?? findValue("registered agent") ?? null;
  const registeredAgent = registeredAgentName;

  const principalAddress =
    findValue("principal office") ??
    findValue("principal address") ??
    findValue("address") ??
    null;

  // NAICS from results table cell (RI shows NAICS in search results, col index 2)
  const naicsCell = cells[2];
  const naicsCode = naicsCell ? text(naicsCell) || null : null;

  const officers: { name: string; title: string }[] = [];
  const officerTable = Array.from(doc.querySelectorAll("table")).find(t => {
    const headers = Array.from(t.querySelectorAll("th, td")).map(c => text(c as Element).toLowerCase());
    return headers.some(h => h.includes("title")) && headers.some(h => h.includes("name") || h.includes("individual"));
  });

  if (officerTable) {
    const oRows = Array.from(officerTable.querySelectorAll("tr")).slice(1);
    for (const r of oRows) {
      const ocells = r.querySelectorAll("td");
      if (ocells.length >= 2) {
        const title = text(ocells[0] as Element);
        const oName = text(ocells[1] as Element);
        if (oName && title) officers.push({ name: oName, title });
      }
    }
  }

  return {
    entity_type: entityType,
    formation_date: formationDate,
    status,
    registered_agent: registeredAgent,
    officers,
    principal_address: principalAddress,
    dba_names: [],
    naics_code: naicsCode,
    matched_name: matchedName || null,
    source_url: sourceUrl,
    state: "RI",
  };
}

// ─── Request Handler ──────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    const { state, name, city } = await req.json() as {
      state: string;
      name: string;
      city: string | null;
    };

    if (!state || !name) {
      return new Response(JSON.stringify({ error: "state and name are required" }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    let result: SosResult | null = null;

    switch (state.toUpperCase()) {
      case "MA":
        result = await scrapeMA(name, city);
        break;
      case "RI":
        result = await scrapeRI(name, city);
        break;
      default:
        return new Response(JSON.stringify({ error: `State ${state} not supported by this function` }), {
          status: 400,
          headers: { ...CORS, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify({ data: result }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});

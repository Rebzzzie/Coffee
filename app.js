const SHEET_ID = "1-BU0n45R8V48VTHS9KLmQSE9CzSZeTlO9N49_Lofvi4";
const GID = "0";
const SHEET_LINK = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit?gid=${GID}#gid=${GID}`;
const SHEET_CSV_URLS = [
  `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`,
  `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${GID}`
];
const MIN_PAIRED_COUNT = 3;
const MIN_PAIRED_PROCESS_COUNT = 2;
const COLOR_ORANGE = "#e9a441";
const COLOR_GREEN = "#79b987";
const RATING_COLORSCALE = [
  [0, "#b2182b"],
  [0.2, "#d6604d"],
  [0.4, "#f4a582"],
  [0.6, "#92c5de"],
  [0.8, "#4393c3"],
  [1, "#2166ac"]
];
const RATING_COLOR_STOPS = RATING_COLORSCALE.map(([stop, hex]) => ({ stop, rgb: hexToRgb(hex) }));
let ORIGIN_MAP_SCALE = null;
let CURRENT_ROWS = [];
const RANK_EXPANDED = {
  topCoffee: false,
  country: false,
  roaster: false
};
const US_STATE_TO_CODE = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA", colorado: "CO",
  connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA", hawaii: "HI", idaho: "ID",
  illinois: "IL", indiana: "IN", iowa: "IA", kansas: "KS", kentucky: "KY", louisiana: "LA",
  maine: "ME", maryland: "MD", massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS",
  missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV", "new hampshire": "NH", "new jersey": "NJ",
  "new mexico": "NM", "new york": "NY", "north carolina": "NC", "north dakota": "ND", ohio: "OH", oklahoma: "OK",
  oregon: "OR", pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC", "south dakota": "SD",
  tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT", virginia: "VA", washington: "WA",
  "west virginia": "WV", wisconsin: "WI", wyoming: "WY", "district of columbia": "DC"
};
const US_STATE_CODES = new Set(Object.values(US_STATE_TO_CODE));
const US_CODE_TO_STATE_NAME = Object.fromEntries(
  Object.entries(US_STATE_TO_CODE).map(([name, code]) => [code, toDisplayCase(name)])
);
const COUNTRY_CODE_TO_NAME = {
  us: "USA",
  mx: "Mexico",
  ca: "Canada",
  sg: "Singapore",
  sgp: "Singapore",
  uk: "UK",
  gb: "UK",
  au: "Australia",
  jp: "Japan",
  kr: "South Korea"
};
const ROASTER_COUNTRY_HINTS = [
  { pattern: /\b(usa|united states|u\.s\.a\.)\b/i, country: "USA" },
  { pattern: /\b(canada|british columbia|ontario|quebec|alberta)\b/i, country: "Canada" },
  { pattern: /\b(uk|united kingdom|england|scotland|wales)\b/i, country: "UK" },
  { pattern: /\b(australia)\b/i, country: "Australia" },
  { pattern: /\b(japan)\b/i, country: "Japan" },
  { pattern: /\b(south korea|korea)\b/i, country: "South Korea" },
  { pattern: /\b(singapore|sg)\b/i, country: "Singapore" }
];
const SMALL_COUNTRY_COORDS = {
  Singapore: { lon: 103.8198, lat: 1.3521 },
  "Hong Kong": { lon: 114.1694, lat: 22.3193 }
};

const STOPWORDS = new Set([
  "the", "and", "for", "that", "this", "with", "was", "are", "its", "it", "but", "not", "have", "has", "had",
  "too", "very", "kind", "really", "like", "just", "from", "they", "them", "their", "would", "could", "there",
  "about", "into", "out", "our", "you", "your", "his", "her", "she", "him", "who", "what", "when", "where",
  "which", "its", "im", "ive", "id", "dont", "didnt", "cant", "isnt", "wont", "a", "an", "to", "of", "in", "on",
  "at", "by", "or", "be", "as", "if", "we", "i", "me", "my", "so", "up", "down", "after", "before", "more"
]);

window.addEventListener("DOMContentLoaded", init);

async function init() {
  const sourceNote = document.getElementById("sourceNote");
  let rawRows = [];

  try {
    rawRows = await loadSheetRows();
  } catch (err) {
    if (sourceNote) sourceNote.textContent = `Could not load Google Sheet data: ${err.message}`;
    return;
  }

  const rows = rawRows.map(normalizeRow).map(toRecord).filter((r) => r.year || r.date || r.avgRating !== null);
  if (!rows.length) {
    if (sourceNote) sourceNote.textContent = "Google Sheet loaded, but no usable rows were found. Check column headers and gid.";
    return;
  }
  ORIGIN_MAP_SCALE = computeOriginMapScale(rows);
  CURRENT_ROWS = rows;
  initRankingControls();

  renderTopCoffeeRank(rows);
  renderMap(rows);
  renderRoasterLocationSection(rows);
  renderCountryRankTable(rows);
  renderRoasterRankTable(rows);
  renderOriginRegionDetails([], "Select an origin country from the map or ranking table");
  renderVarietalChart(rows);
  renderProcessChart(rows);
  renderTasterTop5(rows, "alex");
  renderTasterTop5(rows, "reb");
  renderWordCloud(rows, "alex", "alexCloud", COLOR_ORANGE);
  renderWordCloud(rows, "reb", "rebCloud", COLOR_GREEN);
  renderTastedChart(rows);
  renderRatingsChart(rows);
  renderAlexRebeccaDiff(rows);
  if (sourceNote) sourceNote.textContent = "";
}

function initRankingControls() {
  const bind = (id, key) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.onclick = () => {
      RANK_EXPANDED[key] = !RANK_EXPANDED[key];
      const baseTop = key === "topCoffee" ? 10 : 5;
      btn.textContent = RANK_EXPANDED[key] ? `Show Top ${baseTop}` : "Show All";
      if (!CURRENT_ROWS.length) return;
      if (key === "topCoffee") renderTopCoffeeRank(CURRENT_ROWS);
      if (key === "country") renderCountryRankTable(CURRENT_ROWS);
      if (key === "roaster") renderRoasterRankTable(CURRENT_ROWS);
    };
  };
  bind("toggleTopCoffeeRank", "topCoffee");
  bind("toggleCountryRank", "country");
  bind("toggleRoasterRank", "roaster");
}

async function loadCsv(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to load: ${url}`);
  const text = await response.text();
  const looksLikeHtml = /^\s*<!doctype html/i.test(text) || /^\s*<html/i.test(text);
  if (looksLikeHtml) {
    throw new Error("Google returned HTML, not CSV (sheet likely private or not published).");
  }
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
  if (parsed.errors?.length) {
    throw new Error(parsed.errors[0].message);
  }
  return parsed.data;
}

async function loadSheetRows() {
  let lastError = new Error("Unknown error");
  for (const url of SHEET_CSV_URLS) {
    try {
      const rows = await loadCsv(url);
      if (rows && rows.length) return rows;
      lastError = new Error("Sheet returned no rows.");
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

function normalizeRow(row) {
  const cleaned = {};
  for (const [k, v] of Object.entries(row)) {
    const key = k.replace(/^\uFEFF/, "").trim();
    cleaned[key] = typeof v === "string" ? v.trim() : v;
  }
  return cleaned;
}

function findValue(row, candidates) {
  const keys = Object.keys(row);
  const normalizedMap = new Map(keys.map((k) => [normalizeKey(k), row[k]]));

  for (const candidate of candidates) {
    const exact = normalizedMap.get(normalizeKey(candidate));
    if (exact !== undefined && exact !== "") return exact;
  }

  for (const key of keys) {
    const nk = normalizeKey(key);
    if (candidates.some((c) => nk.includes(normalizeKey(c)))) {
      const value = row[key];
      if (value !== undefined && value !== "") return value;
    }
  }
  return "";
}

function normalizeKey(key) {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function toNumber(value) {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

function parseYear(value) {
  if (value === null || value === undefined || value === "") return null;
  const text = String(value).trim();
  const match = text.match(/(19|20)\d{2}/);
  if (match) return Number.parseInt(match[0], 10);
  const n = Number.parseInt(text, 10);
  if (Number.isFinite(n) && n >= 1900 && n <= 2100) return n;
  return null;
}

function parseDate(value) {
  if (!value) return null;
  const parts = String(value).split("/");
  if (parts.length === 3) {
    const [m, d, y] = parts.map((p) => Number.parseInt(p, 10));
    const year = y < 100 ? 2000 + y : y;
    const dt = new Date(year, m - 1, d);
    if (!Number.isNaN(dt.getTime())) return dt;
  }
  const dt = new Date(value);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function toRecord(row) {
  const roaster = findValue(row, ["Roaster Name", "Roaster"]);
  const roasterLocation = findValue(row, ["Roaster Location", "Roaster City", "Roaster Place"]);
  const coffeeName = findValue(row, ["Coffee Name"]);
  const country = canonicalCountry(findValue(row, ["Coffee Origin Country", "Country"]));
  const varietal = canonicalVarietal(findValue(row, ["Varietal", "Variety"]));
  const process = canonicalProcess(findValue(row, ["Process", "Processing Method", "Processing"]));
  const alexRating = toNumber(findValue(row, ["Alex Rating"]));
  const rebRating = toNumber(findValue(row, ["Rebby Rating", "Rebecca Rating", "Reb Rating"]));

  const ratings = [alexRating, rebRating].filter((x) => x !== null);
  const avgRating = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;

  const date = parseDate(findValue(row, ["Date"]));
  const yearFromColumn = parseYear(findValue(row, ["Year"]));

  return {
    date,
    year: yearFromColumn || (date ? date.getFullYear() : null),
    roaster,
    roasterLocation: toDisplayCase(roasterLocation),
    coffeeName,
    country,
    varietal,
    process,
    isDecaf: isDecafProcess(process),
    alexRating,
    rebRating,
    avgRating,
    alexText: `${findValue(row, ["Alex Tasting Notes", "Alex Tasting"])} `.trim(),
    rebText: `${findValue(row, ["Rebby Tasting", "Rebecca Tasting", "Reb Tasting"])} `.trim()
  };
}

function renderTopCoffeeRank(rows) {
  const grouped = new Map();
  for (const row of rows) {
    if (row.avgRating === null) continue;
    const key = [
      normalizeGroupValue(row.roaster),
      normalizeGroupValue(row.roasterLocation),
      normalizeGroupValue(row.coffeeName),
      normalizeGroupValue(row.country)
    ].join("|");

    if (!grouped.has(key)) {
      grouped.set(key, {
        roaster: row.roaster || "Unknown Roaster",
        roasterLocation: row.roasterLocation || "Unknown Location",
        coffeeName: row.coffeeName || "(Unnamed Coffee)",
        country: row.country || "Unknown Origin",
        hasDecaf: false,
        sum: 0,
        count: 0
      });
    }
    const g = grouped.get(key);
    g.sum += row.avgRating;
    g.count += 1;
    g.hasDecaf = g.hasDecaf || Boolean(row.isDecaf);
  }

  const ranked = [...grouped.entries()]
    .map(([, v]) => ({
      roaster: toDisplayCase(v.roaster),
      roasterLocation: toDisplayCase(v.roasterLocation),
      coffeeName: coffeeNameWithDecaf(v.coffeeName, v.hasDecaf),
      country: toDisplayCase(v.country),
      avg: v.sum / v.count
    }))
    .sort((a, b) => b.avg - a.avg);
  const shown = RANK_EXPANDED.topCoffee ? ranked : ranked.slice(0, 10);

  const tableHtml = [
    "<table>",
    "<thead><tr><th>Roaster</th><th>Roaster Location</th><th>Name</th><th>Origin</th><th>Avg Rating</th></tr></thead>",
    "<tbody>",
    ...shown.map((r) =>
      `<tr><td>${escapeHtml(r.roaster)}</td><td>${escapeHtml(r.roasterLocation)}</td><td>${escapeHtml(r.coffeeName)}</td><td>${escapeHtml(r.country)}</td><td>${formatRatingHtml(r.avg, 2)}</td></tr>`
    ),
    "</tbody></table>"
  ].join("");

  const target = document.getElementById("topCoffeeRankTable");
  if (target) target.innerHTML = tableHtml;
}

function renderTasterTop5(rows, who) {
  const isAlex = who === "alex";
  const targetId = isAlex ? "alexTop5Table" : "rebTop5Table";
  const ratingKey = isAlex ? "alexRating" : "rebRating";
  const grouped = new Map();

  for (const row of rows) {
    const rating = row[ratingKey];
    if (rating === null) continue;
    const key = [
      normalizeGroupValue(row.roaster),
      normalizeGroupValue(row.roasterLocation),
      normalizeGroupValue(row.coffeeName),
      normalizeGroupValue(row.country)
    ].join("|");
    if (!grouped.has(key)) {
      grouped.set(key, {
        coffeeName: row.coffeeName || "(Unnamed Coffee)",
        roaster: row.roaster || "Unknown Roaster",
        roasterLocation: row.roasterLocation || "Unknown Location",
        country: row.country || "Unknown Origin",
        hasDecaf: false,
        sum: 0,
        count: 0
      });
    }
    const g = grouped.get(key);
    g.sum += rating;
    g.count += 1;
    g.hasDecaf = g.hasDecaf || Boolean(row.isDecaf);
  }

  const top5 = [...grouped.values()]
    .map((v) => ({
      coffeeName: coffeeNameWithDecaf(v.coffeeName, v.hasDecaf),
      roaster: toDisplayCase(v.roaster),
      roasterLocation: toDisplayCase(v.roasterLocation),
      country: v.country,
      avg: v.sum / v.count
    }))
    .sort((a, b) => b.avg - a.avg);

  const html = [
    "<table>",
    "<thead><tr><th>Name</th><th>Roaster</th><th>Roaster Location</th><th>Origin</th><th>Rating</th></tr></thead>",
    "<tbody>",
    ...top5.map((r) => `<tr><td>${escapeHtml(r.coffeeName)}</td><td>${escapeHtml(r.roaster)}</td><td>${escapeHtml(r.roasterLocation)}</td><td>${escapeHtml(r.country)}</td><td>${formatRatingHtml(r.avg, 2)}</td></tr>`),
    "</tbody></table>"
  ].join("");

  const target = document.getElementById(targetId);
  if (target) target.innerHTML = html;
}

function renderMap(rows) {
  const grouped = new Map();
  for (const row of rows) {
    if (!row.country || row.avgRating === null) continue;
    const country = canonicalCountry(row.country);
    if (!grouped.has(country)) grouped.set(country, { sum: 0, count: 0, rows: [] });
    const g = grouped.get(country);
    g.sum += row.avgRating;
    g.count += 1;
    g.rows.push(row);
  }

  const countries = [...grouped.keys()];
  const counts = countries.map((c) => grouped.get(c).count);
  const avg = countries.map((c) => grouped.get(c).sum / grouped.get(c).count);
  if (!countries.length) {
    document.getElementById("mapChart").innerHTML = "<p>No country-level rating data available.</p>";
    return;
  }
  const scale = ORIGIN_MAP_SCALE || computeOriginMapScale(rows);
  const colorMin = scale.min;
  const colorMax = scale.max;
  const colorMid = (colorMin + colorMax) / 2;
  ORIGIN_MAP_SCALE = { min: colorMin, max: colorMax, mid: colorMid };

  Plotly.newPlot(
    "mapChart",
    [
      {
        type: "scattergeo",
        mode: "markers",
        locationmode: "country names",
        locations: countries,
        text: countries.map((c, i) => {
          const topCoffees = topCoffeeSummary(grouped.get(c).rows, 3);
          return `${c}<br>Avg Rating: ${avg[i].toFixed(2)}<br>Tastings: ${counts[i]}<br>Top Coffees: ${topCoffees}`;
        }),
        hoverinfo: "text",
        marker: {
          size: counts.map((n) => 10 + n * 2.2),
          color: avg,
          colorscale: RATING_COLORSCALE,
          cmin: colorMin,
          cmax: colorMax,
          cmid: colorMid,
          colorbar: {
            title: "Avg Rating",
            tickformat: ".2f"
          },
          line: { color: "#5c4a35", width: 0.7 }
        }
      }
    ],
    {
      margin: { t: 0, r: 0, b: 0, l: 0 },
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      geo: {
        showframe: false,
        showcoastlines: true,
        coastlinecolor: "#b09b83",
        landcolor: "#f9f1e5",
        bgcolor: "rgba(0,0,0,0)",
        projection: { type: "natural earth" }
      }
    },
    { responsive: true }
  );

  const el = document.getElementById("mapChart");
  el.on("plotly_click", (evt) => {
    const country = evt?.points?.[0]?.location;
    const selected = country && grouped.has(country) ? grouped.get(country).rows : [];
    renderOriginRegionDetails(selected, `Origin Country: ${country}`);
  });
}

function renderRoasterLocationSection(rows) {
  const stateBuckets = buildRoasterBuckets(rows, (r) => extractUsStateCode(r.roasterLocation));
  const countryBuckets = buildRoasterBuckets(rows, (r) => extractRoasterCountry(r.roasterLocation));
  renderRoasterStateMap(stateBuckets);
  renderRoasterCountryMap(countryBuckets);
  renderRoasterRegionDetails([], "Select a state or country on the maps");
}

function buildRoasterBuckets(rows, keyFn) {
  const buckets = new Map();
  for (const row of rows) {
    if (row.avgRating === null) continue;
    const key = keyFn(row);
    if (!key) continue;
    if (!buckets.has(key)) buckets.set(key, { sum: 0, count: 0, rows: [] });
    const bucket = buckets.get(key);
    bucket.sum += row.avgRating;
    bucket.count += 1;
    bucket.rows.push(row);
  }
  return buckets;
}

function renderRoasterStateMap(grouped) {
  const states = [...grouped.keys()];
  const avg = states.map((s) => grouped.get(s).sum / grouped.get(s).count);
  const counts = states.map((s) => grouped.get(s).count);
  const target = document.getElementById("roasterMapChart");
  if (!states.length) {
    target.innerHTML = "<p>No US roaster-location data available.</p>";
    return;
  }
  const scale = ORIGIN_MAP_SCALE || tightRange(avg, 0.15, 0, 10);
  const min = scale.min;
  const max = scale.max;

  Plotly.newPlot(
    "roasterMapChart",
    [
      {
        type: "choropleth",
        locationmode: "USA-states",
        locations: states,
        z: avg,
        zmin: min,
        zmax: max,
        colorscale: RATING_COLORSCALE,
        marker: { line: { color: "#ffffff", width: 1 } },
        colorbar: { title: "Avg Rating", tickformat: ".2f" },
        text: states.map((s, i) => `${s}<br>Avg Rating: ${avg[i].toFixed(2)}<br>Tastings: ${counts[i]}`),
        hovertemplate: "%{text}<extra></extra>"
      }
    ],
    {
      geo: {
        scope: "usa",
        showlakes: false,
        bgcolor: "rgba(0,0,0,0)"
      },
      margin: { t: 0, r: 0, b: 0, l: 0 },
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)"
    },
    { responsive: true }
  );

  const el = document.getElementById("roasterMapChart");
  el.on("plotly_click", (evt) => {
    const code = evt?.points?.[0]?.location;
    const rows = code && grouped.has(code) ? grouped.get(code).rows : [];
    renderRoasterRegionDetails(rows, `Roaster Region: ${code}`);
  });
}

function extractUsStateCode(location) {
  const raw = normalizeGroupValue(location);
  if (!raw) return "";
  const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);
  if (!parts.length) return "";

  const last = parts[parts.length - 1];
  if (/^[a-z]{2}$/.test(last)) {
    const code = last.toUpperCase();
    return US_STATE_CODES.has(code) ? code : "";
  }
  if (US_STATE_TO_CODE[last]) return US_STATE_TO_CODE[last];
  return "";
}

function extractRoasterCountry(location) {
  const value = String(location || "").trim();
  if (!value) return "";
  if (/singapore/i.test(value)) return "Singapore";
  const stateCode = extractUsStateCode(value);
  if (stateCode) return "USA";

  const partsRaw = value.split(",").map((p) => p.trim()).filter(Boolean);
  const lastRaw = partsRaw.length ? partsRaw[partsRaw.length - 1] : "";
  const lastCode = lastRaw.toLowerCase();
  if (COUNTRY_CODE_TO_NAME[lastCode]) return COUNTRY_CODE_TO_NAME[lastCode];

  for (const hint of ROASTER_COUNTRY_HINTS) {
    if (hint.pattern.test(value)) return hint.country;
  }
  const parts = partsRaw.map((p) => toDisplayCase(p));
  if (parts.length === 1) return parts[0];
  if (parts.length >= 2) return parts[parts.length - 1];
  return "";
}

function renderRoasterCountryMap(grouped) {
  const countries = [...grouped.keys()];
  const avg = countries.map((c) => grouped.get(c).sum / grouped.get(c).count);
  const counts = countries.map((c) => grouped.get(c).count);
  const target = document.getElementById("roasterCountryMapChart");
  if (!countries.length) {
    target.innerHTML = "<p>No roaster-country data available.</p>";
    return;
  }
  const scale = ORIGIN_MAP_SCALE || tightRange(avg, 0.15, 0, 10);
  const min = scale.min;
  const max = scale.max;

  const baseTrace = {
    type: "scattergeo",
    mode: "markers",
    showlegend: false,
    locationmode: "country names",
    locations: countries,
    marker: {
      size: counts.map((n) => 10 + n * 2.2),
      color: avg,
      colorscale: RATING_COLORSCALE,
      cmin: min,
      cmax: max,
      cmid: (min + max) / 2,
      line: { color: "#5c4a35", width: 0.7 }
    },
    text: countries.map((c, i) => `${c}<br>Avg Rating: ${avg[i].toFixed(2)}<br>Tastings: ${counts[i]}`),
    hovertemplate: "%{text}<extra></extra>",
    customdata: countries
  };

  const smallCountries = countries
    .map((country, i) => ({
      country,
      avg: avg[i],
      count: counts[i],
      coord: SMALL_COUNTRY_COORDS[country]
    }))
    .filter((x) => x.coord);

  const overlayTrace = smallCountries.length
    ? {
        type: "scattergeo",
        mode: "markers",
        lon: smallCountries.map((x) => x.coord.lon),
        lat: smallCountries.map((x) => x.coord.lat),
        marker: {
          size: smallCountries.map((x) => 14 + x.count * 2.5),
          color: smallCountries.map((x) => x.avg),
          colorscale: RATING_COLORSCALE,
          cmin: min,
          cmax: max,
          cmid: (min + max) / 2,
          line: { color: "#5c4a35", width: 0.7 },
          symbol: "circle"
        },
        text: smallCountries.map((x) => `${x.country}<br>Avg Rating: ${x.avg.toFixed(2)}<br>Tastings: ${x.count}`),
        hovertemplate: "%{text}<extra></extra>",
        customdata: smallCountries.map((x) => x.country),
        showlegend: false
      }
    : null;

  Plotly.newPlot(
    "roasterCountryMapChart",
    overlayTrace ? [baseTrace, overlayTrace] : [baseTrace],
    {
      margin: { t: 0, r: 0, b: 0, l: 0 },
      showlegend: false,
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      geo: {
        showframe: false,
        showcoastlines: true,
        coastlinecolor: "#b09b83",
        landcolor: "#f9f1e5",
        bgcolor: "rgba(0,0,0,0)",
        projection: { type: "natural earth" }
      }
    },
    { responsive: true }
  );

  const el = document.getElementById("roasterCountryMapChart");
  el.on("plotly_click", (evt) => {
    const pt = evt?.points?.[0];
    const country = pt?.customdata || pt?.location;
    const rows = country && grouped.has(country) ? grouped.get(country).rows : [];
    renderRoasterRegionDetails(rows, `Roaster Region: ${country}`);
  });
}

function renderRoasterRegionDetails(rows, title) {
  const target = document.getElementById("roasterRegionDetails");
  if (!target) return;
  if (!rows.length) {
    target.innerHTML = `<p>${escapeHtml(title)}</p>`;
    return;
  }
  const sorted = [...rows].sort((a, b) => (b.avgRating || 0) - (a.avgRating || 0)).slice(0, 30);
  const html = [
    `<table><thead><tr><th colspan=\"7\">${escapeHtml(title)} (${rows.length} coffees)</th></tr>`,
    "<tr><th>Name</th><th>Roaster</th><th>Roaster Location</th><th>Origin</th><th>Alex</th><th>Rebecca</th><th>Avg</th></tr></thead>",
    "<tbody>",
    ...sorted.map(
      (r) =>
        `<tr><td>${escapeHtml(coffeeNameWithDecaf(r.coffeeName || "", r.isDecaf))}</td><td>${escapeHtml(toDisplayCase(
          r.roaster || ""
        ))}</td><td>${escapeHtml(r.roasterLocation || "")}</td><td>${escapeHtml(r.country || "")}</td><td>${
          r.alexRating === null ? "" : formatRatingHtml(r.alexRating, 1)
        }</td><td>${r.rebRating === null ? "" : formatRatingHtml(r.rebRating, 1)}</td><td>${
          r.avgRating === null ? "" : formatRatingHtml(r.avgRating, 2)
        }</td></tr>`
    ),
    "</tbody></table>"
  ].join("");
  target.innerHTML = html;
}

function topCoffeeSummary(rows, limit = 3) {
  if (!rows || !rows.length) return "N/A";
  const grouped = new Map();
  for (const row of rows) {
    if (row.avgRating === null) continue;
    const key = [
      normalizeGroupValue(row.coffeeName),
      normalizeGroupValue(row.roaster)
    ].join("|");
    if (!grouped.has(key)) {
      grouped.set(key, {
        coffeeName: row.coffeeName || "(Unnamed)",
        roaster: row.roaster || "Unknown Roaster",
        hasDecaf: false,
        sum: 0,
        count: 0
      });
    }
    const bucket = grouped.get(key);
    bucket.sum += row.avgRating;
    bucket.count += 1;
    bucket.hasDecaf = bucket.hasDecaf || Boolean(row.isDecaf);
  }

  return [...grouped.values()]
    .map((v) => ({
      avg: v.sum / v.count,
      label: `${coffeeNameWithDecaf(v.coffeeName, v.hasDecaf)} (${(v.sum / v.count).toFixed(2)})`
    }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, limit)
    .map((x) => x.label)
    .join("; ");
}

function renderCountryRankTable(rows) {
  const byCountry = new Map();
  for (const row of rows) {
    if (!row.country || row.avgRating === null) continue;
    const country = canonicalCountry(row.country);
    if (!byCountry.has(country)) {
      byCountry.set(country, {
        sum: 0,
        count: 0,
        rows: [],
        coffees: new Map()
      });
    }

    const countryBucket = byCountry.get(country);
    countryBucket.sum += row.avgRating;
    countryBucket.count += 1;
    countryBucket.rows.push(row);

    const coffeeKey = [
      normalizeGroupValue(row.roaster),
      normalizeGroupValue(row.coffeeName),
      normalizeGroupValue(country)
    ].join("|");
    if (!countryBucket.coffees.has(coffeeKey)) {
      countryBucket.coffees.set(coffeeKey, {
        roaster: row.roaster || "Unknown Roaster",
        coffeeName: row.coffeeName || "(Unnamed Coffee)",
        hasDecaf: false,
        sum: 0,
        count: 0
      });
    }
    const coffeeBucket = countryBucket.coffees.get(coffeeKey);
    coffeeBucket.sum += row.avgRating;
    coffeeBucket.count += 1;
    coffeeBucket.hasDecaf = coffeeBucket.hasDecaf || Boolean(row.isDecaf);
  }

  const ranked = [...byCountry.entries()]
    .map(([country, bucket]) => {
      const bestCoffee = [...bucket.coffees.values()]
        .map((c) => ({
          name: `${coffeeNameWithDecaf(c.coffeeName, c.hasDecaf)} - ${toDisplayCase(c.roaster)}`,
          avg: c.sum / c.count
        }))
        .sort((a, b) => b.avg - a.avg)[0];

      return {
        country,
        avg: bucket.sum / bucket.count,
        count: bucket.count,
        bestCoffee: bestCoffee ? bestCoffee.name : "N/A",
        bestCoffeeAvg: bestCoffee ? bestCoffee.avg : null
      };
    })
    .sort((a, b) => b.avg - a.avg);
  const shown = RANK_EXPANDED.country ? ranked : ranked.slice(0, 5);

  const html = [
    "<table>",
    "<thead><tr><th>#</th><th>Origin Country</th><th>Avg Rating</th><th>Coffees Tasted</th><th>Best Coffee</th><th>Best Avg</th></tr></thead>",
    "<tbody>",
    ...shown.map(
      (r, idx) =>
        `<tr data-origin-country="${encodeURIComponent(r.country)}"><td>${idx + 1}</td><td>${escapeHtml(r.country)}</td><td>${formatRatingHtml(
          r.avg,
          2
        )}</td><td>${r.count}</td><td>${escapeHtml(r.bestCoffee)}</td><td>${
          r.bestCoffeeAvg === null ? "N/A" : formatRatingHtml(r.bestCoffeeAvg, 2)
        }</td></tr>`
    ),
    "</tbody>",
    "</table>"
  ].join("");

  const target = document.getElementById("countryRankTable");
  target.innerHTML = html;

  target.querySelectorAll("tr[data-origin-country]").forEach((rowEl) => {
    rowEl.style.cursor = "pointer";
    rowEl.addEventListener("click", () => {
      const country = decodeURIComponent(rowEl.getAttribute("data-origin-country") || "");
      const selectedRows = country && byCountry.has(country) ? byCountry.get(country).rows : [];
      renderOriginRegionDetails(selectedRows, `Origin Country: ${country}`);
    });
  });
}

function renderRoasterRankTable(rows) {
  const grouped = new Map();
  for (const row of rows) {
    if (row.avgRating === null) continue;
    const state = extractUsStateCode(row.roasterLocation);
    const label = state ? `${US_CODE_TO_STATE_NAME[state] || state}, US` : extractRoasterCountry(row.roasterLocation);
    if (!label) continue;
    if (!grouped.has(label)) grouped.set(label, { sum: 0, count: 0, coffees: new Map() });
    const bucket = grouped.get(label);
    bucket.sum += row.avgRating;
    bucket.count += 1;

    const coffeeKey = [
      normalizeGroupValue(row.roaster),
      normalizeGroupValue(row.coffeeName),
      normalizeGroupValue(row.country)
    ].join("|");
    if (!bucket.coffees.has(coffeeKey)) {
      bucket.coffees.set(coffeeKey, {
        coffeeName: row.coffeeName || "(Unnamed Coffee)",
        roaster: row.roaster || "Unknown Roaster",
        hasDecaf: false,
        sum: 0,
        count: 0
      });
    }
    const coffeeBucket = bucket.coffees.get(coffeeKey);
    coffeeBucket.sum += row.avgRating;
    coffeeBucket.count += 1;
    coffeeBucket.hasDecaf = coffeeBucket.hasDecaf || Boolean(row.isDecaf);
  }

  const ranked = [...grouped.entries()]
    .map(([location, b]) => {
      const bestCoffee = [...b.coffees.values()]
        .map((c) => ({
          name: `${coffeeNameWithDecaf(c.coffeeName, c.hasDecaf)} - ${toDisplayCase(c.roaster)}`,
          avg: c.sum / c.count
        }))
        .sort((a, b2) => b2.avg - a.avg)[0];

      return {
        location,
        avg: b.sum / b.count,
        count: b.count,
        bestCoffee: bestCoffee ? bestCoffee.name : "N/A",
        bestCoffeeAvg: bestCoffee ? bestCoffee.avg : null
      };
    })
    .sort((a, b) => b.avg - a.avg);
  const shown = RANK_EXPANDED.roaster ? ranked : ranked.slice(0, 5);

  const html = [
    "<table>",
    "<thead><tr><th>#</th><th>Roaster Location</th><th>Avg Rating</th><th>Coffees Tasted</th><th>Best Coffee</th><th>Best Avg</th></tr></thead>",
    "<tbody>",
    ...shown.map((r, idx) => `<tr><td>${idx + 1}</td><td>${escapeHtml(r.location)}</td><td>${formatRatingHtml(r.avg, 2)}</td><td>${r.count}</td><td>${escapeHtml(r.bestCoffee)}</td><td>${r.bestCoffeeAvg === null ? "N/A" : formatRatingHtml(r.bestCoffeeAvg, 2)}</td></tr>`),
    "</tbody></table>"
  ].join("");

  const target = document.getElementById("roasterRankTable");
  if (target) target.innerHTML = html;
}

function renderOriginRegionDetails(rows, title) {
  const target = document.getElementById("originRegionDetails");
  if (!target) return;
  if (!rows.length) {
    target.innerHTML = `<p>${escapeHtml(title)}</p>`;
    return;
  }
  const sorted = [...rows].sort((a, b) => (b.avgRating || 0) - (a.avgRating || 0)).slice(0, 40);
  const html = [
    `<table><thead><tr><th colspan=\"8\">${escapeHtml(title)} (${rows.length} coffees)</th></tr>`,
    "<tr><th>Name</th><th>Roaster</th><th>Roaster Location</th><th>Process</th><th>Varietal</th><th>Alex</th><th>Rebecca</th><th>Avg</th></tr></thead>",
    "<tbody>",
    ...sorted.map(
      (r) =>
        `<tr><td>${escapeHtml(coffeeNameWithDecaf(r.coffeeName || "", r.isDecaf))}</td><td>${escapeHtml(toDisplayCase(
          r.roaster || ""
        ))}</td><td>${escapeHtml(r.roasterLocation || "")}</td><td>${escapeHtml(r.process || "")}</td><td>${escapeHtml(
          r.varietal || ""
        )}</td><td>${r.alexRating === null ? "" : formatRatingHtml(r.alexRating, 1)}</td><td>${
          r.rebRating === null ? "" : formatRatingHtml(r.rebRating, 1)
        }</td><td>${r.avgRating === null ? "" : formatRatingHtml(r.avgRating, 2)}</td></tr>`
    ),
    "</tbody></table>"
  ].join("");
  target.innerHTML = html;
}

function renderVarietalChart(rows) {
  const filtered = rows.filter((r) => r.avgRating !== null && r.varietal && r.varietal !== "Unknown");
  const grouped = groupRatingRows(filtered, (r) => r.varietal);
  const ranked = [...grouped.entries()]
    .map(([name, bucket]) => ({ name, avg: bucket.sum / bucket.count, count: bucket.count }))
    .filter((r) => r.name !== "Other")
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)
    .sort((a, b) => b.avg - a.avg);

  const target = document.getElementById("varietalChart");
  if (!ranked.length) {
    target.innerHTML = "<p>No varietal data available.</p>";
    return;
  }

  const x = ranked.map((r) => r.name);
  const y = ranked.map((r) => r.avg);
  const counts = ranked.map((r) => r.count);
  const { min, max } = tightRange(y, 0.2, 0, 10);

  Plotly.newPlot(
    "varietalChart",
    [
      {
        type: "bar",
        x,
        y,
        text: counts.map((c) => String(c)),
        textposition: "outside",
        cliponaxis: false,
        hovertemplate: "%{x}<br>Avg Rating: %{y:.2f}<br>Count: %{text}<extra></extra>",
        marker: {
          color: y,
          cmin: min,
          cmax: max,
          cmid: (min + max) / 2,
          colorscale: RATING_COLORSCALE
        }
      }
    ],
    {
      margin: { t: 10, r: 10, b: 55, l: 45 },
      xaxis: { title: "Varietal", tickangle: -20 },
      yaxis: { title: "Avg Rating", range: [min, max] },
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)"
    },
    { responsive: true }
  );
}

function renderProcessChart(rows) {
  const filtered = rows.filter((r) => r.avgRating !== null && r.process && r.process !== "Unknown");
  const grouped = groupRatingRows(filtered, (r) => r.process);
  const ranked = [...grouped.entries()]
    .map(([name, bucket]) => ({ name, avg: bucket.sum / bucket.count, count: bucket.count }))
    .filter((r) => r.name !== "Other")
    .sort((a, b) => b.avg - a.avg);

  const target = document.getElementById("processChart");
  if (!ranked.length) {
    target.innerHTML = "<p>No process data available.</p>";
    return;
  }

  const x = ranked.map((r) => r.name);
  const y = ranked.map((r) => r.avg);
  const counts = ranked.map((r) => r.count);
  const { min, max } = tightRange(y, 0.2, 0, 10);

  Plotly.newPlot(
    "processChart",
    [
      {
        type: "bar",
        x,
        y,
        text: counts.map((c) => String(c)),
        textposition: "outside",
        cliponaxis: false,
        hovertemplate: "%{x}<br>Avg Rating: %{y:.2f}<br>Count: %{text}<extra></extra>",
        marker: {
          color: y,
          cmin: min,
          cmax: max,
          cmid: (min + max) / 2,
          colorscale: RATING_COLORSCALE
        }
      }
    ],
    {
      margin: { t: 10, r: 10, b: 55, l: 45 },
      xaxis: { title: "Process", tickangle: -20 },
      yaxis: { title: "Avg Rating", range: [min, max] },
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)"
    },
    { responsive: true }
  );
}

function renderWordCloud(rows, key, elementId, color) {
  const text = rows.map((r) => (key === "alex" ? r.alexText : r.rebText)).join(" ");
  const frequencies = wordFrequency(text);
  const words = frequencies.slice(0, 80).map(({ text: t, value }) => ({ text: t, size: 12 + Math.sqrt(value) * 8 }));

  const container = document.getElementById(elementId);
  const width = container.clientWidth || 480;
  const height = 340;

  container.innerHTML = "";

  d3.layout.cloud()
    .size([width, height])
    .words(words)
    .padding(2)
    .rotate(() => (Math.random() > 0.85 ? 90 : 0))
    .font('"Avenir Next", sans-serif')
    .fontSize((d) => d.size)
    .on("end", (layoutWords) => drawCloud(layoutWords, container, width, height, color))
    .start();
}

function drawCloud(words, container, width, height, color) {
  d3.select(container)
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .append("g")
    .attr("transform", `translate(${width / 2},${height / 2})`)
    .selectAll("text")
    .data(words)
    .enter()
    .append("text")
    .style("font-size", (d) => `${d.size}px`)
    .style("font-family", '"Avenir Next", sans-serif')
    .style("fill", color)
    .attr("text-anchor", "middle")
    .attr("transform", (d) => `translate(${[d.x, d.y]})rotate(${d.rotate})`)
    .text((d) => d.text);
}

function wordFrequency(text) {
  const tokens = String(text)
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));

  const map = new Map();
  for (const word of tokens) {
    map.set(word, (map.get(word) || 0) + 1);
  }
  return [...map.entries()]
    .map(([textKey, value]) => ({ text: textKey, value }))
    .sort((a, b) => b.value - a.value);
}

function renderTastedChart(rows) {
  const byYear = new Map();
  for (const row of rows) {
    const year = row.year || (row.date ? row.date.getFullYear() : null);
    if (!year) continue;
    byYear.set(year, (byYear.get(year) || 0) + 1);
  }
  const x = [...byYear.keys()].sort((a, b) => a - b);
  const y = x.map((year) => byYear.get(year));

  Plotly.newPlot(
    "tastedChart",
    [{ x, y, type: "bar", marker: { color: "#8a5a2b" } }],
    {
      margin: { t: 10, r: 10, b: 45, l: 45 },
      xaxis: { title: "Year", type: "category" },
      yaxis: { title: "Coffees Tasted" },
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)"
    },
    { responsive: true }
  );
}

function renderRatingsChart(rows) {
  const byYear = new Map();
  for (const row of rows) {
    if (row.avgRating === null) continue;
    const year = row.year || (row.date ? row.date.getFullYear() : null);
    if (!year) continue;
    if (!byYear.has(year)) byYear.set(year, { sum: 0, count: 0, values: [] });
    const bucket = byYear.get(year);
    bucket.sum += row.avgRating;
    bucket.count += 1;
    bucket.values.push(row.avgRating);
  }

  const x = [...byYear.keys()].sort((a, b) => a - b);
  const yAvg = x.map((year) => byYear.get(year).sum / byYear.get(year).count);
  const yMedian = x.map((year) => median(byYear.get(year).values));
  const { min: yMin, max: yMax } = tightRange([...yAvg, ...yMedian], 0.2, 0, 10);

  Plotly.newPlot(
    "ratingsChart",
    [
      {
        x,
        y: yAvg,
        name: "Average Rating",
        type: "scatter",
        mode: "lines+markers",
        line: { color: "#2f3e5b", width: 3 },
        marker: {
          size: 11,
          color: yAvg,
          cmin: yMin,
          cmax: yMax,
          cmid: (yMin + yMax) / 2,
          colorscale: RATING_COLORSCALE,
          line: { color: "#ffffff", width: 1 }
        }
      },
      {
        x,
        y: yMedian,
        name: "Median Rating",
        type: "scatter",
        mode: "lines+markers",
        line: { color: "#6f7f95", width: 2, dash: "dot" },
        marker: { color: "#6f7f95", size: 8 }
      }
    ],
    {
      margin: { t: 10, r: 10, b: 45, l: 45 },
      xaxis: { title: "Year", type: "category" },
      yaxis: { title: "Rating", range: [yMin, yMax] },
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      legend: { orientation: "h", y: 1.12, yanchor: "bottom", x: 0, xanchor: "left" }
    },
    { responsive: true }
  );
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

function tightRange(values, padding = 0.2, minLimit = 0, maxLimit = 10) {
  if (!values.length) return { min: minLimit, max: maxLimit };
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  if (minVal === maxVal) {
    return {
      min: Math.max(minLimit, minVal - 0.5),
      max: Math.min(maxLimit, maxVal + 0.5)
    };
  }
  return {
    min: Math.max(minLimit, minVal - padding),
    max: Math.min(maxLimit, maxVal + padding)
  };
}

function groupRatingRows(rows, keyFn) {
  const grouped = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    if (!key) continue;
    if (!grouped.has(key)) grouped.set(key, { sum: 0, count: 0 });
    const bucket = grouped.get(key);
    bucket.sum += row.avgRating;
    bucket.count += 1;
  }
  return grouped;
}

function normalizeGroupValue(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function canonicalCountry(value) {
  const raw = toDisplayCase(value || "").trim();
  if (!raw) return "";
  const aliases = new Map([
    ["Usa", "USA"],
    ["U.S.A.", "USA"],
    ["United States Of America", "USA"],
    ["Uk", "UK"],
    ["U.K.", "UK"]
  ]);
  return aliases.get(raw) || raw;
}

function canonicalVarietal(value) {
  const raw = normalizeGroupValue(value);
  if (!raw) return "Unknown";
  if (raw.includes("bourbon")) return "Bourbon";
  if (raw.includes("castillo")) return "Castillo";
  if (raw.includes("caturra")) return "Caturra";
  if (raw.includes("catuai")) return "Catuai";
  if (raw.includes("gesha") || raw.includes("geisha")) return "Gesha/Geisha";
  if (raw.includes("typica")) return "Typica";
  if (raw.includes("heirloom") || raw.includes("landrace")) return "Heirloom/Landrace";
  if (raw.includes("parainema")) return "Parainema";
  if (raw.includes("sl28") || raw.includes("sl-28") || raw.includes("sl 28") || raw.includes("sl34") || raw.includes("sl-34") || raw.includes("sl 34")) {
    return "SL28/SL34";
  }
  return "Other";
}

function canonicalProcess(value) {
  const raw = normalizeGroupValue(value);
  if (!raw) return "Unknown";
  if (raw.includes("anaerobic") || raw.includes("carbonic")) return "Anaerobic/Fermented";
  if (raw.includes("co-ferment") || raw.includes("experimental") || raw.includes("infused") || raw.includes("thermal shock")) {
    return "Experimental";
  }
  if (raw.includes("honey")) return "Honey";
  if (raw.includes("natural") || raw.includes("dry process")) return "Natural/Dry";
  if (raw.includes("wet hulled") || raw.includes("giling basah")) return "Wet-Hulled";
  if (raw.includes("washed") || raw.includes("wet process")) return "Washed";
  return "Other";
}

function renderAlexRebeccaDiff(rows) {
  const paired = rows.filter((r) => r.alexRating !== null && r.rebRating !== null);
  renderTasterCountryCompare(paired);
  renderTasterYearCompare(paired);
  renderTasterProcessCompare(paired);
}

function renderTasterCountryCompare(rows) {
  const compared = buildPairedComparison(rows, (r) => canonicalCountry(r.country), MIN_PAIRED_COUNT)
    .filter((r) => r.key && r.key !== "Unknown")
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  renderPairedBarChart("tasterCountryChart", compared, "Country", "Avg Rating");
}

function renderTasterYearCompare(rows) {
  const compared = buildPairedComparison(
    rows,
    (r) => String(r.year || (r.date ? r.date.getFullYear() : "")),
    1
  ).sort((a, b) => Number.parseInt(a.key, 10) - Number.parseInt(b.key, 10));

  renderPairedBarChart("tasterYearChart", compared, "Year", "Avg Rating");
}

function renderTasterProcessCompare(rows) {
  const compared = buildPairedComparison(rows, (r) => r.process, MIN_PAIRED_PROCESS_COUNT)
    .filter((r) => r.key && r.key !== "Unknown" && r.key !== "Other")
    .sort((a, b) => b.count - a.count);

  renderPairedBarChart("tasterProcessChart", compared, "Process", "Avg Rating");
}

function buildPairedComparison(rows, keyFn, minCount = 1) {
  const grouped = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    if (!key) continue;
    if (!grouped.has(key)) grouped.set(key, { alex: 0, reb: 0, count: 0 });
    const bucket = grouped.get(key);
    bucket.alex += row.alexRating;
    bucket.reb += row.rebRating;
    bucket.count += 1;
  }

  return [...grouped.entries()]
    .map(([key, b]) => ({
      key,
      alexAvg: b.alex / b.count,
      rebAvg: b.reb / b.count,
      count: b.count
    }))
    .filter((r) => r.count >= minCount);
}

function renderPairedBarChart(elementId, rows, xTitle, yTitle) {
  const target = document.getElementById(elementId);
  if (!rows.length) {
    target.innerHTML = "<p>Not enough paired Alex/Rebecca ratings for this view yet.</p>";
    return;
  }

  const x = rows.map((r) => r.key);
  const alex = rows.map((r) => r.alexAvg);
  const reb = rows.map((r) => r.rebAvg);
  const counts = rows.map((r) => r.count);
  const allY = [...alex, ...reb];
  const { min, max } = tightRange(allY, 0.2, 0, 10);

  Plotly.newPlot(
    elementId,
    [
      {
        type: "bar",
        name: "Alex",
        x,
        y: alex,
        marker: { color: COLOR_ORANGE },
        hovertemplate: "%{x}<br>Alex Avg: %{y:.2f}<br>Count: %{customdata}<extra></extra>",
        customdata: counts
      },
      {
        type: "bar",
        name: "Rebecca",
        x,
        y: reb,
        marker: { color: COLOR_GREEN },
        hovertemplate: "%{x}<br>Rebecca Avg: %{y:.2f}<br>Count: %{customdata}<extra></extra>",
        customdata: counts
      }
    ],
    {
      barmode: "group",
      margin: { t: 10, r: 10, b: 55, l: 45 },
      xaxis: { title: xTitle, tickangle: -20 },
      yaxis: { title: yTitle, range: [min, max] },
      legend: { orientation: "h" },
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)"
    },
    { responsive: true }
  );
}

function toDisplayCase(value) {
  const raw = String(value || "").trim();
  if (!raw) return raw;

  return raw
    .split(/\s+/)
    .map((word) => {
      if (/^[A-Z]{2,4}$/.test(word)) return word;
      return word.replace(/[A-Za-z]+(?:'[A-Za-z]+)?/g, (segment) => {
        return segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase();
      });
    })
    .join(" ");
}

function renderFullDataTable(rows) {
  const target = document.getElementById("fullDataTable");
  if (!target) return;

  const sorted = [...rows].sort((a, b) => {
    const ay = a.year || 0;
    const by = b.year || 0;
    if (ay !== by) return by - ay;
    const ad = a.date ? a.date.getTime() : 0;
    const bd = b.date ? b.date.getTime() : 0;
    return bd - ad;
  });

  const html = [
    "<table>",
    "<thead><tr><th>Year</th><th>Name</th><th>Country Origin</th><th>Process</th><th>Alex Rating</th><th>Alex Notes</th><th>Rebecca Rating</th><th>Rebecca Notes</th></tr></thead>",
    "<tbody>",
    ...sorted.map((r) => {
      const alexLabel = r.alexRating === null ? "" : r.alexRating.toFixed(1);
      const rebLabel = r.rebRating === null ? "" : r.rebRating.toFixed(1);
      return `<tr><td>${r.year || ""}</td><td>${escapeHtml(coffeeNameWithDecaf(r.coffeeName || "", r.isDecaf))}</td><td>${escapeHtml(
        r.country || ""
      )}</td><td>${escapeHtml(r.process || "")}</td><td>${alexLabel}</td><td>${escapeHtml(
        r.alexText || ""
      )}</td><td>${rebLabel}</td><td>${escapeHtml(r.rebText || "")}</td></tr>`;
    }),
    "</tbody>",
    "</table>"
  ].join("");

  target.innerHTML = html;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatRatingHtml(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) return "";
  const text = Number(value).toFixed(digits);
  return `<span style="color:${ratingColor(value)};font-weight:600;">${text}</span>`;
}

function ratingColor(value) {
  const scale = ORIGIN_MAP_SCALE || { min: 0, max: 10 };
  const min = scale.min;
  const max = scale.max;
  const range = max - min || 1;
  const t = Math.max(0, Math.min(1, (Number(value) - min) / range));
  if (t <= RATING_COLOR_STOPS[0].stop) return rgbToHex(RATING_COLOR_STOPS[0].rgb);
  for (let i = 1; i < RATING_COLOR_STOPS.length; i++) {
    const a = RATING_COLOR_STOPS[i - 1];
    const b = RATING_COLOR_STOPS[i];
    if (t <= b.stop) {
      const local = (t - a.stop) / (b.stop - a.stop || 1);
      const rgb = {
        r: Math.round(a.rgb.r + (b.rgb.r - a.rgb.r) * local),
        g: Math.round(a.rgb.g + (b.rgb.g - a.rgb.g) * local),
        b: Math.round(a.rgb.b + (b.rgb.b - a.rgb.b) * local)
      };
      return rgbToHex(rgb);
    }
  }
  return rgbToHex(RATING_COLOR_STOPS[RATING_COLOR_STOPS.length - 1].rgb);
}

function computeOriginMapScale(rows) {
  const grouped = new Map();
  for (const row of rows) {
    if (!row.country || row.avgRating === null) continue;
    const country = canonicalCountry(row.country);
    if (!grouped.has(country)) grouped.set(country, { sum: 0, count: 0 });
    const bucket = grouped.get(country);
    bucket.sum += row.avgRating;
    bucket.count += 1;
  }
  const avg = [...grouped.values()].map((v) => v.sum / v.count);
  return avg.length ? tightRange(avg, 0.15, 0, 10) : { min: 0, max: 10 };
}

function hexToRgb(hex) {
  const s = String(hex).replace("#", "");
  const full = s.length === 3 ? s.split("").map((c) => c + c).join("") : s;
  return {
    r: Number.parseInt(full.slice(0, 2), 16),
    g: Number.parseInt(full.slice(2, 4), 16),
    b: Number.parseInt(full.slice(4, 6), 16)
  };
}

function rgbToHex({ r, g, b }) {
  const toHex = (n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function isDecafProcess(process) {
  return /\bdecaf\b/i.test(String(process || ""));
}

function coffeeNameWithDecaf(name, hasDecaf) {
  const base = toDisplayCase(name || "");
  return hasDecaf ? `${base} *` : base;
}

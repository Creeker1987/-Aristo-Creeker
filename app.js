const config = window.ARISTO_CONFIG || {};
const apiUrl = config.supabaseUrl;
const apiKey = config.supabasePublishableKey;
const form = document.querySelector("#suggest");
const cards = document.querySelector("#cards");
const template = document.querySelector("#card-template");
const search = document.querySelector("#search");
const musicFilter = document.querySelector("#music-filter");
const totalCount = document.querySelector("#total-count");
const cityCount = document.querySelector("#city-count");
const formNote = document.querySelector("#form-note");
const submitButton = form.querySelector("button[type='submit']");
const installButton = document.querySelector("#install-app");
const installButtonText = document.querySelector("#install-app-text");
const installHelp = document.querySelector("#install-help");
let venues = [];
let deferredInstallPrompt = null;

function normalize(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function apiHeaders(extra = {}) {
  return { apikey: apiKey, Authorization: `Bearer ${apiKey}`, ...extra };
}

function safeLink(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function mapLinkForVenue(venue) {
  const query = [venue.name, venue.city, venue.state].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function showsLinkForVenue(venue) {
  const query = [venue.name, venue.city, venue.state, "live music events schedule"].filter(Boolean).join(" ");
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

function addVenueLink(parent, href, text) {
  const link = document.createElement("a");
  link.href = href;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = text;
  parent.appendChild(link);
}

function populateMusicFilter() {
  const current = musicFilter.value;
  const styles = [...new Set(venues.flatMap((venue) => venue.music_types || []))]
    .filter(Boolean).sort((a, b) => a.localeCompare(b));
  musicFilter.innerHTML = '<option value="">All music styles</option>';
  styles.forEach((style) => {
    const option = document.createElement("option");
    option.value = style;
    option.textContent = style;
    musicFilter.appendChild(option);
  });
  musicFilter.value = styles.includes(current) ? current : "";
}

function venueHaystack(venue) {
  return [venue.city, venue.state, venue.name, venue.local_artist, venue.regional_act,
    ...(venue.act_types || []), ...(venue.music_types || []), ...(venue.features || []),
    ...(venue.recommendations || []).flatMap((item) => [item.creeker_name, item.description, item.creeker_tip])
  ].join(" ").toLowerCase();
}

function addTextLine(parent, labelText, value) {
  if (!value) return;
  const line = document.createElement("p");
  const label = document.createElement("span");
  label.className = "artist-label";
  label.textContent = `${labelText}: `;
  line.append(label, document.createTextNode(value));
  parent.appendChild(line);
}

function renderRecommendations(card, recommendations) {
  card.querySelector(".note").remove();
  card.querySelector(".submitted").remove();
  if (!recommendations.length) return;
  const article = card.querySelector("article");
  const heading = document.createElement("h4");
  heading.className = "recommendation-heading";
  heading.textContent = recommendations.length === 1 ? "1 Creeker recommendation" : `${recommendations.length} Creeker recommendations`;
  article.appendChild(heading);
  const list = document.createElement("div");
  list.className = "recommendation-list";
  recommendations.forEach((item) => {
    const entry = document.createElement("section");
    entry.className = "recommendation";
    if (item.description) {
      const description = document.createElement("p");
      description.className = "note";
      description.textContent = item.description;
      entry.appendChild(description);
    }
    if (item.creeker_tip) {
      const tip = document.createElement("p");
      tip.className = "creeker-tip";
      const strong = document.createElement("strong");
      strong.textContent = "Creeker Tip: ";
      tip.append(strong, document.createTextNode(item.creeker_tip));
      entry.appendChild(tip);
    }
    const submitted = document.createElement("p");
    submitted.className = "submitted";
    submitted.textContent = item.creeker_name ? `Suggested by ${item.creeker_name}` : "Community suggestion";
    entry.appendChild(submitted);
    list.appendChild(entry);
  });
  article.appendChild(list);
}

function renderVenues() {
  const query = normalize(search.value).toLowerCase();
  const selectedMusic = musicFilter.value;
  const filtered = venues.filter((venue) => (!query || venueHaystack(venue).includes(query)) &&
    (!selectedMusic || (venue.music_types || []).includes(selectedMusic)));
  cards.innerHTML = "";
  totalCount.textContent = String(filtered.length);
  cityCount.textContent = String(new Set(filtered.map((venue) => `${venue.city}, ${venue.state}`)).size);
  if (!filtered.length) {
    cards.innerHTML = venues.length
      ? '<p class="empty">No approved venues match that search yet. Try another city or share a recommendation.</p>'
      : '<p class="empty">The shared guide is ready for its first approved venue.</p>';
    return;
  }
  filtered.forEach((venue) => {
    const card = template.content.cloneNode(true);
    const recommendations = (venue.recommendations || []).slice()
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const musicTypes = venue.music_types || [];
    const actTypes = venue.act_types || [];
    let actTag = "Venue profile";
    if (actTypes.includes("Local artists") && actTypes.includes("Regional acts")) actTag = "Local and regional acts";
    else if (actTypes.includes("Local artists")) actTag = "Local acts";
    else if (actTypes.includes("Regional acts")) actTag = "Regional acts";
    card.querySelector(".tag").textContent = actTag;
    card.querySelector(".location").textContent = `${venue.city}, ${venue.state}`;
    card.querySelector("h3").textContent = venue.name;
    const musicTag = card.querySelector(".music-tag");
    if (musicTypes.length) musicTag.textContent = musicTypes.join(" / ");
    else musicTag.remove();
    const venueLink = card.querySelector(".venue-link");
    addVenueLink(venueLink, mapLinkForVenue(venue), "Map & venue details");
    addVenueLink(venueLink, showsLinkForVenue(venue), "Find current shows");
    const href = safeLink(venue.website_url);
    if (href) addVenueLink(venueLink, href, "Official venue page");
    const artistList = card.querySelector(".artist-list");
    addTextLine(artistList, "Local artist to check out", venue.local_artist);
    addTextLine(artistList, "Regional act seen here", venue.regional_act);
    if (!artistList.children.length) artistList.remove();
    const details = card.querySelector(".venue-details");
    (venue.features || []).filter(Boolean).forEach((detail) => {
      const tag = document.createElement("span");
      tag.textContent = detail;
      details.appendChild(tag);
    });
    if (!details.children.length) details.remove();
    renderRecommendations(card, recommendations);
    cards.appendChild(card);
  });
}

async function loadVenues() {
  if (!apiUrl || !apiKey) {
    cards.innerHTML = '<p class="empty">The shared venue guide is not connected yet.</p>';
    return;
  }
  cards.innerHTML = '<p class="empty">Loading approved venues…</p>';
  const select = ["id", "name", "city", "state", "website_url", "features", "act_types", "music_types",
    "local_artist", "regional_act", "recommendations(id,creeker_name,description,creeker_tip,created_at)"].join(",");
  try {
    const response = await fetch(`${apiUrl}/rest/v1/venues?select=${encodeURIComponent(select)}&approved=eq.true&order=city.asc,name.asc`,
      { headers: apiHeaders() });
    if (!response.ok) throw new Error(`Unable to load venues (${response.status})`);
    venues = await response.json();
    populateMusicFilter();
    renderVenues();
  } catch (error) {
    console.error(error);
    cards.innerHTML = '<p class="empty">The venue guide could not load right now. Please try again shortly.</p>';
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const payload = {
    p_name: normalize(data.get("venue")), p_city: normalize(data.get("city")),
    p_state: normalize(data.get("state")).toUpperCase(), p_website_url: normalize(data.get("link")),
    p_features: data.getAll("features"), p_act_types: data.getAll("actTypes"), p_music_types: data.getAll("musicTypes"),
    p_local_artist: normalize(data.get("localArtist")), p_regional_act: normalize(data.get("regionalAct")),
    p_creeker_name: normalize(data.get("name")), p_description: normalize(data.get("note")),
    p_creeker_tip: normalize(data.get("tip"))
  };
  submitButton.disabled = true;
  submitButton.textContent = "Sending suggestion…";
  formNote.textContent = "";
  try {
    const response = await fetch(`${apiUrl}/rest/v1/rpc/submit_venue`, {
      method: "POST", headers: apiHeaders({ "Content-Type": "application/json" }), body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const details = await response.json().catch(() => ({}));
      throw new Error(details.message || "The suggestion could not be submitted.");
    }
    form.reset();
    formNote.textContent = "Thank you. Your suggestion was sent for review and will appear after approval.";
  } catch (error) {
    console.error(error);
    formNote.textContent = error.message || "The suggestion could not be submitted. Please try again.";
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Share suggestion";
  }
});

search.addEventListener("input", renderVenues);
musicFilter.addEventListener("change", renderVenues);

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
});

if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
  installButtonText.textContent = "Add AristoCreekers to Phone";
} else {
  installButtonText.textContent = "Install AristoCreekers";
}

installButton.addEventListener("click", async () => {
  installHelp.hidden = false;
  if (window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone) {
    installHelp.textContent = "AristoCreekers is already installed on this device.";
    return;
  }
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    return;
  }
  if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    installHelp.textContent = "On iPhone or iPad: tap Safari’s Share button, choose Add to Home Screen, then tap Add.";
  } else {
    installHelp.textContent = "Open your browser menu and choose Install app or Add to Home screen.";
  }
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js"));
}

loadVenues();

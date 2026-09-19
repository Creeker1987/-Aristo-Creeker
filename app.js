const seedSuggestions = [];

const storageKey = "aristocreekers-suggestions";
const form = document.querySelector("#suggest");
const cards = document.querySelector("#cards");
const template = document.querySelector("#card-template");
const search = document.querySelector("#search");
const totalCount = document.querySelector("#total-count");
const cityCount = document.querySelector("#city-count");
const formNote = document.querySelector("#form-note");
const clearLocal = document.querySelector("#clear-local");

function getLocalSuggestions() {
  try {
    return JSON.parse(localStorage.getItem(storageKey)) || [];
  } catch {
    return [];
  }
}

function saveLocalSuggestions(suggestions) {
  localStorage.setItem(storageKey, JSON.stringify(suggestions));
}

function allSuggestions() {
  return [...getLocalSuggestions(), ...seedSuggestions];
}

function displaySuggestions() {
  const localSuggestions = getLocalSuggestions().map((item, index) => ({
    ...item,
    localIndex: index
  }));
  const starterSuggestions = seedSuggestions.map((item) => ({
    ...item,
    localIndex: null
  }));

  return [...localSuggestions, ...starterSuggestions];
}

function normalize(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function renderSuggestions() {
  const query = search.value.trim().toLowerCase();
  const suggestions = displaySuggestions();
  const filtered = suggestions.filter((item) => {
    const haystack = [
      item.city,
      item.state,
      item.venue,
      item.artist,
      item.localArtist,
      item.regionalAct,
      item.actTypes,
      item.musicTypes,
      item.features,
      item.tip,
      item.note,
      item.name
    ].join(" ").toLowerCase();

    return haystack.includes(query);
  });

  cards.innerHTML = "";
  totalCount.textContent = String(filtered.length);
  cityCount.textContent = String(new Set(filtered.map((item) => `${item.city}, ${item.state}`)).size);

  if (filtered.length === 0) {
    cards.innerHTML = '<p class="empty">No venues match that search yet. Add one and help the guide grow.</p>';
    return;
  }

  filtered.forEach((item) => {
    const card = template.content.cloneNode(true);
    const musicTypes = item.musicTypes || (item.genre ? [item.genre] : []);
    const actTypes = item.actTypes || [];
    const hasLocalActs = actTypes.includes("Local artists") || musicTypes.includes("Local bands");
    const hasRegionalActs = actTypes.includes("Regional acts") || musicTypes.includes("Regional touring acts");
    const localArtist = item.localArtist || (item.artistScope === "Local" ? item.artist : "");
    const regionalAct = item.regionalAct || (item.artistScope === "Regional" ? item.artist : "");
    const fallbackArtist = !localArtist && !regionalAct ? item.artist : "";
    let actTag = fallbackArtist ? "Artist tip" : "Venue pick";
    if (localArtist && regionalAct) {
      actTag = "Local Artist + Regional Act";
    } else if (localArtist) {
      actTag = "Local Artist";
    } else if (regionalAct) {
      actTag = "Regional Act";
    } else if (hasLocalActs && hasRegionalActs) {
      actTag = "Local and regional acts";
    } else if (hasLocalActs) {
      actTag = "Local acts";
    } else if (hasRegionalActs) {
      actTag = "Regional acts";
    }
    card.querySelector(".tag").textContent = actTag;
    const musicTag = card.querySelector(".music-tag");
    const musicStyleTypes = musicTypes.filter((type) => type !== "Local bands" && type !== "Regional touring acts");
    if (musicStyleTypes.length) {
      musicTag.textContent = musicStyleTypes.join(" / ");
    } else {
      musicTag.remove();
    }
    card.querySelector(".location").textContent = `${item.city}, ${item.state}`;
    card.querySelector("h3").textContent = item.venue;
    const venueLink = card.querySelector(".venue-link");
    if (item.link) {
      const link = document.createElement("a");
      link.href = item.link;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = item.link.replace(/^https?:\/\//, "");
      venueLink.appendChild(link);
    } else {
      venueLink.remove();
    }
    const artistList = card.querySelector(".artist-list");
    [
      ["Local artist to check out", localArtist],
      ["Regional act seen here", regionalAct],
      ["Artist to check out", fallbackArtist]
    ].filter(([, value]) => value).forEach(([labelText, value]) => {
      const artistLine = document.createElement("p");
      const label = document.createElement("span");
      label.className = "artist-label";
      label.textContent = `${labelText}: `;
      artistLine.append(label, document.createTextNode(value));
      artistList.appendChild(artistLine);
    });
    if (!artistList.children.length) {
      artistList.remove();
    }
    const details = card.querySelector(".venue-details");
    (item.features || []).filter(Boolean).forEach((detail) => {
      const detailTag = document.createElement("span");
      detailTag.textContent = detail;
      details.appendChild(detailTag);
    });
    card.querySelector(".note").textContent = item.note || "Recommended by someone who wants travelers to find the local sound.";
    const submitted = card.querySelector(".submitted");
    submitted.textContent = item.name ? `Suggested by ${item.name}` : "Community suggestion";
    if (item.localIndex !== null) {
      const removeButton = document.createElement("button");
      removeButton.className = "remove-card";
      removeButton.type = "button";
      removeButton.textContent = "Remove this card";
      removeButton.addEventListener("click", () => {
        const localSuggestions = getLocalSuggestions();
        const [removed] = localSuggestions.splice(item.localIndex, 1);
        saveLocalSuggestions(localSuggestions);
        formNote.textContent = removed?.venue
          ? `Removed ${removed.venue}. Your other cards stayed saved.`
          : "Removed that card. Your other cards stayed saved.";
        renderSuggestions();
      });
      submitted.after(removeButton);
    }
    cards.appendChild(card);
  });
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(form);
  const suggestion = {
    city: normalize(formData.get("city")),
    state: normalize(formData.get("state")).toUpperCase(),
    venue: normalize(formData.get("venue")),
    artist: "",
    localArtist: normalize(formData.get("localArtist")),
    regionalAct: normalize(formData.get("regionalAct")),
    artistScope: "",
    genre: "",
    actTypes: formData.getAll("actTypes"),
    musicTypes: formData.getAll("musicTypes"),
    features: formData.getAll("features"),
    link: normalize(formData.get("link")),
    active: "",
    tip: "",
    name: normalize(formData.get("name")),
    note: normalize(formData.get("note"))
  };

  const localSuggestions = getLocalSuggestions();
  saveLocalSuggestions([suggestion, ...localSuggestions]);
  form.reset();
  formNote.textContent = "Saved on this computer. Nice, the venue guide just got more local.";
  search.value = `${suggestion.city} ${suggestion.state}`;
  renderSuggestions();
});

search.addEventListener("input", renderSuggestions);

clearLocal.addEventListener("click", () => {
  localStorage.removeItem(storageKey);
  formNote.textContent = "Your added suggestions were cleared from this browser.";
  renderSuggestions();
});

renderSuggestions();

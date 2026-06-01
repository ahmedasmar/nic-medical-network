const DATA_URL = "data/providers.json";
const META_URL = "data/metadata.json";
const FAVORITES_KEY = "nic-medical-network:favorites";
const PAGE_SIZE = 100;
const SEARCH_ALIASES = {
  pharmacy: ["صيدلية"],
  pharmacies: ["صيدلية"],
  pharmace: ["صيدلية"],
  pharma: ["صيدلية"],
  drugstore: ["صيدلية"],
  medicine: ["صيدلية"],
  doctor: ["طبيب"],
  doctors: ["طبيب"],
  dr: ["طبيب"],
  physician: ["طبيب"],
  hospital: ["مستشفى"],
  hospitals: ["مستشفى"],
  lab: ["مختبر"],
  labs: ["مختبر"],
  laboratory: ["مختبر"],
  xray: ["مركز أشعة"],
  "x-ray": ["مركز أشعة"],
  radiology: ["مركز أشعة"],
  optical: ["مركز بصريات"],
  optics: ["مركز بصريات"],
  emergency: ["مركز طوارئ"],
  physio: ["مركز علاج طبيعي"],
  physiotherapy: ["مركز علاج طبيعي"],
  physical: ["مركز علاج طبيعي"],
  therapy: ["مركز علاج طبيعي"],
  dentist: ["أسنان", "اسنان"],
  dental: ["أسنان", "اسنان"],
  heart: ["قلب"],
  cardio: ["قلب"],
  pediatric: ["أطفال", "اطفال"],
  children: ["أطفال", "اطفال"],
  women: ["نسائية"],
  obgyn: ["نسائية", "توليد"],
  ramallah: ["رام الله"],
  ram: ["رام الله"],
  nablus: ["نابلس"],
  hebron: ["الخليل"],
  khalil: ["الخليل"],
  alkhalil: ["الخليل"],
  jerusalem: ["القدس"],
  quds: ["القدس"],
  alquds: ["القدس"],
  bethlehem: ["بيت لحم"],
  beitlahm: ["بيت لحم"],
  jenin: ["جنين"],
  tulkarem: ["طولكرم"],
  qalqilya: ["قلقيليه"],
  qalqilia: ["قلقيليه"],
  salfit: ["سلفيت"],
  tubas: ["طوباس"],
  jericho: ["اريحا"],
  ariha: ["اريحا"],
  gaza: ["غزه", "غزة"],
  gazah: ["غزه", "غزة"],
  rafah: ["رفح"],
  khanyounis: ["خان يونس"],
  khanyunis: ["خان يونس"],
  khan: ["خان يونس"],
  younis: ["خان يونس"],
  yunis: ["خان يونس"],
  deir: ["دير البلح"],
  balah: ["دير البلح"]
};

const state = {
  providers: [],
  metadata: null,
  visibleCount: PAGE_SIZE,
  favorites: new Set(JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]")),
  filters: {
    query: "",
    city: "",
    careType: "",
    specialty: "",
    favoritesOnly: false
  }
};

const els = {
  syncStatus: document.querySelector("#syncStatus"),
  queryInput: document.querySelector("#queryInput"),
  cityFilter: document.querySelector("#cityFilter"),
  typeFilter: document.querySelector("#typeFilter"),
  specialtyFilter: document.querySelector("#specialtyFilter"),
  favoriteFilter: document.querySelector("#favoriteFilter"),
  resetButton: document.querySelector("#resetButton"),
  exportButton: document.querySelector("#exportButton"),
  clearFavoritesButton: document.querySelector("#clearFavoritesButton"),
  resultCount: document.querySelector("#resultCount"),
  resultMeta: document.querySelector("#resultMeta"),
  results: document.querySelector("#results"),
  loadMoreButton: document.querySelector("#loadMoreButton"),
  providerTemplate: document.querySelector("#providerTemplate")
};

function normalize(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/\u0640/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .toLowerCase()
    .trim();
}

function tokenAlternatives(token) {
  return [token, ...(SEARCH_ALIASES[token] || [])]
    .map(normalize)
    .filter(Boolean);
}

function providerKey(provider) {
  return [
    provider.city,
    provider.name,
    provider.careType,
    provider.specialty,
    provider.location,
    provider.workPhone,
    provider.mobile
  ].join("|");
}

function isProbablyArabic(value) {
  return /[\u0600-\u06FF]/.test(value);
}

function formatDate(value) {
  if (!value) {
    return "No sync yet";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function setOptions(select, values, placeholder) {
  select.textContent = "";
  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = placeholder;
  select.append(defaultOption);

  for (const value of values) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.append(option);
  }
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "ar"));
}

function saveFavorites() {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify([...state.favorites]));
}

function matchesProvider(provider) {
  const favorite = state.favorites.has(providerKey(provider));
  if (state.filters.favoritesOnly && !favorite) {
    return false;
  }

  if (state.filters.city && provider.city !== state.filters.city) {
    return false;
  }

  if (state.filters.careType && provider.careType !== state.filters.careType) {
    return false;
  }

  if (state.filters.specialty && provider.specialty !== state.filters.specialty) {
    return false;
  }

  if (!state.filters.query) {
    return true;
  }

  const haystack = normalize([
    provider.city,
    provider.name,
    provider.careType,
    provider.specialty,
    provider.location,
    provider.workPhone,
    provider.mobile
  ].join(" "));

  return state.filters.query
    .split(/\s+/)
    .filter(Boolean)
    .every((token) => tokenAlternatives(token).some((alternative) => haystack.includes(alternative)));
}

function getFilteredProviders() {
  return state.providers
    .filter(matchesProvider)
    .sort((a, b) => {
      const aFavorite = state.favorites.has(providerKey(a));
      const bFavorite = state.favorites.has(providerKey(b));
      if (aFavorite !== bFavorite) {
        return aFavorite ? -1 : 1;
      }
      return `${a.city} ${a.name}`.localeCompare(`${b.city} ${b.name}`, "ar");
    });
}

function phoneLinks(provider) {
  return [
    ["Work", provider.workPhone],
    ["Mobile", provider.mobile]
  ]
    .filter(([, value]) => value)
    .flatMap(([label, value]) =>
      value.split(",").map((phone) => ({
        label,
        phone: phone.trim()
      }))
    )
    .filter(({ phone }) => phone && phone !== "-");
}

function makeMapUrl(provider) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    [provider.location, provider.city, "Palestine"].filter(Boolean).join(" ")
  )}`;
}

function renderProvider(provider) {
  const key = providerKey(provider);
  const node = els.providerTemplate.content.firstElementChild.cloneNode(true);
  const title = node.querySelector("h2");
  const favoriteButton = node.querySelector(".favorite-button");
  const actions = node.querySelector(".provider-actions");

  node.dir = isProbablyArabic(`${provider.name} ${provider.location}`) ? "rtl" : "ltr";
  node.querySelector(".provider-type").textContent = provider.careType || "Provider";
  title.textContent = provider.name || "Unnamed provider";
  node.querySelector(".provider-city").textContent = provider.city || "-";
  node.querySelector(".provider-specialty").textContent = provider.specialty || "-";
  node.querySelector(".provider-location").textContent = provider.location || "-";

  favoriteButton.classList.toggle("is-active", state.favorites.has(key));
  favoriteButton.textContent = state.favorites.has(key) ? "★" : "☆";
  favoriteButton.addEventListener("click", () => {
    if (state.favorites.has(key)) {
      state.favorites.delete(key);
    } else {
      state.favorites.add(key);
    }
    saveFavorites();
    render();
  });

  for (const { label, phone } of phoneLinks(provider)) {
    const link = document.createElement("a");
    link.className = "action-link";
    link.href = `tel:${phone}`;
    link.textContent = `${label}: ${phone}`;
    actions.append(link);
  }

  if (provider.location) {
    const mapLink = document.createElement("a");
    mapLink.className = "action-link";
    mapLink.href = makeMapUrl(provider);
    mapLink.target = "_blank";
    mapLink.rel = "noopener";
    mapLink.textContent = "Map";
    actions.append(mapLink);
  }

  return node;
}

function render() {
  const filtered = getFilteredProviders();
  const page = filtered.slice(0, state.visibleCount);

  els.results.textContent = "";
  els.results.append(...page.map(renderProvider));

  els.resultCount.textContent = `${filtered.length.toLocaleString()} result${filtered.length === 1 ? "" : "s"}`;
  els.resultMeta.textContent = `Showing ${page.length.toLocaleString()} of ${filtered.length.toLocaleString()} providers.`;
  els.loadMoreButton.hidden = page.length >= filtered.length;
  els.clearFavoritesButton.hidden = state.favorites.size === 0;
}

function resetVisibleCount() {
  state.visibleCount = PAGE_SIZE;
}

function bindEvents() {
  els.queryInput.addEventListener("input", () => {
    state.filters.query = normalize(els.queryInput.value);
    resetVisibleCount();
    render();
  });

  els.cityFilter.addEventListener("change", () => {
    state.filters.city = els.cityFilter.value;
    resetVisibleCount();
    render();
  });

  els.typeFilter.addEventListener("change", () => {
    state.filters.careType = els.typeFilter.value;
    resetVisibleCount();
    render();
  });

  els.specialtyFilter.addEventListener("change", () => {
    state.filters.specialty = els.specialtyFilter.value;
    resetVisibleCount();
    render();
  });

  els.favoriteFilter.addEventListener("change", () => {
    state.filters.favoritesOnly = els.favoriteFilter.value === "favorites";
    resetVisibleCount();
    render();
  });

  els.resetButton.addEventListener("click", () => {
    els.queryInput.value = "";
    els.cityFilter.value = "";
    els.typeFilter.value = "";
    els.specialtyFilter.value = "";
    els.favoriteFilter.value = "";
    state.filters = {
      query: "",
      city: "",
      careType: "",
      specialty: "",
      favoritesOnly: false
    };
    resetVisibleCount();
    render();
  });

  els.loadMoreButton.addEventListener("click", () => {
    state.visibleCount += PAGE_SIZE;
    render();
  });

  els.clearFavoritesButton.addEventListener("click", () => {
    state.favorites.clear();
    saveFavorites();
    render();
  });

  els.exportButton.addEventListener("click", async () => {
    const payload = getFilteredProviders();
    const text = JSON.stringify(payload, null, 2);
    await navigator.clipboard.writeText(text);
    els.exportButton.textContent = "Copied";
    setTimeout(() => {
      els.exportButton.textContent = "Export visible";
    }, 1200);
  });
}

async function loadData() {
  const [providersResponse, metadataResponse] = await Promise.all([fetch(DATA_URL), fetch(META_URL)]);
  if (!providersResponse.ok || !metadataResponse.ok) {
    throw new Error("Could not load provider data.");
  }

  state.providers = await providersResponse.json();
  state.metadata = await metadataResponse.json();

  const facets = state.metadata.facets || {};
  setOptions(els.cityFilter, facets.cities || uniqueSorted(state.providers.map((provider) => provider.city)), "All cities");
  setOptions(els.typeFilter, facets.careTypes || uniqueSorted(state.providers.map((provider) => provider.careType)), "All types");
  setOptions(
    els.specialtyFilter,
    facets.specialties || uniqueSorted(state.providers.map((provider) => provider.specialty)),
    "All specialties"
  );

  els.syncStatus.textContent = `Synced ${formatDate(state.metadata.syncedAt)}`;
  render();
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

bindEvents();
loadData().catch((error) => {
  els.syncStatus.textContent = "Data unavailable";
  els.resultCount.textContent = "Could not load data";
  els.resultMeta.textContent = error.message;
});

export const SEARCH_ALIASES = {
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

export function normalize(value) {
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

export function providerSearchText(provider) {
  return normalize([
    provider.city,
    provider.name,
    provider.careType,
    provider.specialty,
    provider.location,
    provider.workPhone,
    provider.mobile
  ].join(" "));
}

export function providerMatchesQuery(provider, query) {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) {
    return true;
  }

  const haystack = providerSearchText(provider);
  return normalizedQuery
    .split(/\s+/)
    .filter(Boolean)
    .every((token) => tokenAlternatives(token).some((alternative) => haystack.includes(alternative)));
}

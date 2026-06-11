export const SUPPORTED_LANGS = ["ro", "ru", "en"];
export const DEFAULT_LANG = "ro";
const STORAGE_KEY = "reverie_lang";

let _lang = DEFAULT_LANG;
let _translations = {};
let _listeners = [];

function _localesBase() {
  const p = window.location.pathname;

  if (/\/pages\/[^/]+\//.test(p)) return "../../locales/";

  if (p.includes("/pages/")) return "../locales/";

  return "locales/";
}

async function _loadTranslations(lang) {
  try {
    const res = await fetch(`${_localesBase()}${lang}.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn(`[i18n] Cannot load "${lang}.json", falling back to "${DEFAULT_LANG}".`, err);
    if (lang !== DEFAULT_LANG) return _loadTranslations(DEFAULT_LANG);
    return {};
  }
}


// ── Translation lookup
export function t(key, vars = {}) {
  const parts = key.split(".");
  let node = _translations;
  for (const p of parts) {
    if (node && typeof node === "object" && p in node) { node = node[p]; }
    else { console.warn(`[i18n] Missing key "${key}" in "${_lang}"`); return key; }
  }
  if (typeof node !== "string") return key;
  return node.replace(/\{\{(\w+)\}\}/g, (_, k) => (k in vars ? vars[k] : `{{${k}}}`));
}

// ── Get current language
export function getCurrentLanguage() { return _lang; }

export async function setLanguage(lang) {
  if (!SUPPORTED_LANGS.includes(lang)) lang = DEFAULT_LANG;
  if (lang === _lang && Object.keys(_translations).length > 0) return;
  _translations = await _loadTranslations(lang);
  _lang = lang;
  try { localStorage.setItem(STORAGE_KEY, lang); } catch { }
  document.documentElement.lang = lang;
  _notify();
}

// ── Language change listener
export function onLanguageChange(fn) {
  _listeners.push(fn);
  return () => { _listeners = _listeners.filter(l => l !== fn); };
}

function _notify() {
  _listeners.forEach(fn => { try { fn(_lang, _translations); } catch (e) { console.error(e); } });
}

// ── Init
export async function initI18n() {
  let saved; try { saved = localStorage.getItem(STORAGE_KEY); } catch { }
  let chosen = DEFAULT_LANG;
  if (saved && SUPPORTED_LANGS.includes(saved)) {
    chosen = saved;
  } else {
    const bl = (navigator.language || "").slice(0, 2).toLowerCase();
    if (SUPPORTED_LANGS.includes(bl)) chosen = bl;
  }
  await setLanguage(chosen);
  return _lang;
}


// ── Apply translations to DOM
export function translatePage() {
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    const attr = el.getAttribute("data-i18n-attr");
    if (attr) el.setAttribute(attr, t(key));
    else el.textContent = t(key);
  });
  const titleKey = document.body?.dataset?.metaTitle;
  if (titleKey) document.title = t(titleKey);
  const descKey = document.body?.dataset?.metaDesc;
  const metaDesc = document.querySelector('meta[name="description"]');
  if (descKey && metaDesc) metaDesc.setAttribute("content", t(descKey));
}


const TYPE_ALIASES = {
  apartment: ["apartament", "apartment", "квартира", "apartament la sol", "ground floor apartment"],
  house: ["casă", "casa", "house", "дом", "jumătate de casă", "half house", "semi-detached"],
  land: ["teren", "terenuri", "land", "участок", "земля", "teren pentru constructii",
    "teren agricol", "agricultural land"],
  commercial: ["comercial", "commercial", "коммерческий", "restaurant", "bar", "magazin",
    "store", "shop", "магазин", "depozit", "warehouse", "склад"],
  office: ["birou", "birouri", "office", "офис", "oficiu"],
  garage: ["garaj", "garaje", "garage", "гараж"],
  villa: ["vilă", "vila", "vile", "villa", "вилла"],
  studio: ["studio", "студия"],
  penthouse: ["penthouse", "пентхаус"],
};

function _norm(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

// ── Normalization helpers
export function normalizeType(raw) {
  if (!raw) return "";
  const n = _norm(raw);
  for (const [canonical, aliases] of Object.entries(TYPE_ALIASES)) {
    if (canonical === n || aliases.map(_norm).includes(n)) return canonical;
  }
  return n;
}

export function normalizeTransaction(raw) {
  if (!raw) return "sale";
  const n = _norm(raw);
  if (["chirie", "inchiriere", "rent", "rental", "аренда"].includes(n)) return "rent";
  return "sale";
}

export function normalizeStatus(raw) {
  const v = _norm(raw || "active");
  if (["active", "activ"].includes(v)) return "active";
  if (["stopped", "stopat", "paused", "inactive"].includes(v)) return "stopped";
  if (["rented", "inchiriat", "rent"].includes(v)) return "rented";
  if (["sold", "vandut", "vândut"].includes(v)) return "sold";
  return "active";
}


const PROP_TYPE_DISPLAY = {
  apartment: { ro: "Apartament", ru: "Квартира", en: "Apartment" },
  house: { ro: "Casă", ru: "Дом", en: "House" },
  land: { ro: "Teren", ru: "Участок", en: "Land" },
  commercial: { ro: "Comercial", ru: "Коммерческий", en: "Commercial" },
  office: { ro: "Birou", ru: "Офис", en: "Office" },
  garage: { ro: "Garaj", ru: "Гараж", en: "Garage" },
  villa: { ro: "Vilă", ru: "Вилла", en: "Villa" },
  studio: { ro: "Studio", ru: "Студия", en: "Studio" },
  penthouse: { ro: "Penthouse", ru: "Пентхаус", en: "Penthouse" },
};

// ── Translation helpers for property fields
export function translateType(canonical) {
  return PROP_TYPE_DISPLAY[canonical]?.[_lang]
    ?? PROP_TYPE_DISPLAY[canonical]?.ro
    ?? canonical;
}

export function translateTransaction(canonical) {
  return t(`transaction.${canonical}`) || canonical;
}

export function translateStatus(canonical) {
  return t(`status.${canonical}`) || "";
}

export function roomsLabel(nStr) {
  const n = Number(String(nStr).trim());
  if (!Number.isFinite(n) || n <= 0) return String(nStr || "").trim();
  if (_lang === "ru") {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return t("rooms.one", { n });
    if ([2, 3, 4].includes(m10) && ![12, 13, 14].includes(m100)) return t("rooms.few", { n });
    return t("rooms.many", { n });
  }
  return n === 1 ? t("rooms.one", { n }) : t("rooms.many", { n });
}


const RAW_PROP_TYPE_MAP = {
  "Apartament la sol": { ro: "Apartament la sol", ru: "Квартира на земле", en: "Ground Floor Apartment" },
  "Apartament": { ro: "Apartament", ru: "Квартира", en: "Apartment" },
  "Casă": { ro: "Casă", ru: "Дом", en: "House" },
  "Jumătate de casă": { ro: "Jumătate de casă", ru: "Полдома", en: "Semi-Detached House" },
  "Comercial": { ro: "Comercial", ru: "Коммерческий", en: "Commercial" },
  "Restaurant": { ro: "Restaurant", ru: "Ресторан", en: "Restaurant" },
  "Bar": { ro: "Bar", ru: "Бар", en: "Bar" },
  "Oficiu": { ro: "Oficiu", ru: "Офис", en: "Office" },
  "Magazin": { ro: "Magazin", ru: "Магазин", en: "Store" },
  "Depozit": { ro: "Depozit", ru: "Склад", en: "Warehouse" },
  "Teren": { ro: "Teren", ru: "Участок", en: "Land" },
  "Teren pentru construcții": { ro: "Teren pentru construcții", ru: "Участок под строительство", en: "Building Plot" },
  "Teren Agricol": { ro: "Teren Agricol", ru: "Сельскохозяйственный участок", en: "Agricultural Land" },
  "Garaj": { ro: "Garaj", ru: "Гараж", en: "Garage" },
};


export function translatePropertyTypeRaw(raw) {
  if (!raw) return "";
  const entry = RAW_PROP_TYPE_MAP[raw] || RAW_PROP_TYPE_MAP[String(raw).trim()];
  if (entry) return entry[_lang] ?? entry.ro ?? raw;

  const canonical = normalizeType(raw);
  if (canonical && PROP_TYPE_DISPLAY[canonical]) return translateType(canonical);
  return raw;
}


const FEATURE_MAP = {
  "Reparație Cosmetică": { ru: "Косметический ремонт", en: "Cosmetic Renovation" },
  "Metaloplast": { ru: "Металлопластик", en: "PVC Windows" },
  "Parc": { ru: "Парк", en: "Park" },
  "Încălzire Autonomă": { ru: "Автономное отопление", en: "Autonomous Heating" },
  "Pereți din Cotileț": { ru: "Стены из ракушника", en: "Shell Rock Walls" },
  "În curs de reparație": { ru: "В процессе ремонта", en: "Under Renovation" },
  "Pereți din Beton": { ru: "Бетонные стены", en: "Concrete Walls" },
  "Ușă blindată": { ru: "Бронированная дверь", en: "Armoured Door" },
  "Fără reparații": { ru: "Без ремонта", en: "No Renovation" },
  "Piață Alimentară": { ru: "Продовольственный рынок", en: "Food Market" },
  "Apartament tip „Hrușiovka\"": { ru: "Хрущёвка", en: "Khrushchevka-Type Flat" },
  "Loc de joacă pentru copii": { ru: "Детская площадка", en: "Children's Playground" },
  "Subsol/Cămară": { ru: "Подвал/Кладовая", en: "Basement/Storage" },
  "Spital/Policlinică": { ru: "Больница/Поликлиника", en: "Hospital/Clinic" },
  "Interfon": { ru: "Домофон", en: "Intercom" },
  "Grădiniță": { ru: "Детский сад", en: "Kindergarten" },
  "Variantă Albă": { ru: "Черновая отделка (белый вариант)", en: "White Box Finish" },
  "Variantă Gri": { ru: "Черновая отделка (серый вариант)", en: "Grey Box Finish" },
  "Pereți de bloc": { ru: "Панельные стены", en: "Panel Block Walls" },
  "Laminat": { ru: "Ламинат", en: "Laminate Flooring" },
  "Supermarket": { ru: "Супермаркет", en: "Supermarket" },
  "Pereți Combinați": { ru: "Комбинированные стены", en: "Combined Walls" },
  "Aer condiționat": { ru: "Кондиционер", en: "Air Conditioning" },
  "Magazine": { ru: "Магазины", en: "Shops" },
  "Apartament Seria 143": { ru: "Серия 143", en: "Series 143 Flat" },
  "Linie Telefonică": { ru: "Телефонная линия", en: "Telephone Line" },
  "Apartament Seria 102": { ru: "Серия 102", en: "Series 102 Flat" },
  "Mobilată": { ru: "Меблированная", en: "Furnished" },
  "Parțial renovat": { ru: "Частично отремонтировано", en: "Partially Renovated" },
  "Apartament Seria 135": { ru: "Серия 135", en: "Series 135 Flat" },
  "Încălzire Sobă": { ru: "Печное отопление", en: "Stove Heating" },
  "Locuri de parcare": { ru: "Парковочные места", en: "Parking Spaces" },
  "Necesită renovare": { ru: "Требует ремонта", en: "Needs Renovation" },
  "Sistem de semnalizare": { ru: "Сигнализация", en: "Alarm System" },
  "Bucătărie de vară": { ru: "Летняя кухня", en: "Summer Kitchen" },
  "Școală": { ru: "Школа", en: "School" },
  "Bloc Nou": { ru: "Новостройка", en: "New Building" },
  "Apartament tip „Individual\"": { ru: "Индивидуальный проект", en: "Custom Design Flat" },
  "Apartament tip „Rubașka\"": { ru: "Квартира типа Рубашка", en: "Rubashka-Type Flat" },
  "Parcare publică": { ru: "Общественная парковка", en: "Public Parking" },
  "Lift": { ru: "Лифт", en: "Elevator" },
  "Cablu TV": { ru: "Кабельное TV", en: "Cable TV" },
  "Anexă": { ru: "Пристройка", en: "Annex" },
  "Pereți din Cărămidă": { ru: "Кирпичные стены", en: "Brick Walls" },
  "Proiect Individual": { ru: "Индивидуальный проект", en: "Individual Project" },
  "Podele încălzite": { ru: "Тёплый пол", en: "Underfloor Heating" },
  "Construcție spre demolare": { ru: "Под снос", en: "Slated for Demolition" },
  "Reparație Euro": { ru: "Евроремонт", en: "Euro Renovation" },
  "Bucătărie": { ru: "Кухня", en: "Kitchen" },
  "Pereți Monolit": { ru: "Монолитные стены", en: "Monolithic Walls" },
  "Parcare subterană": { ru: "Подземная парковка", en: "Underground Parking" },
  "Termopan": { ru: "Стеклопакет", en: "Double Glazing" },
  "Cazan": { ru: "Котёл", en: "Boiler" },
  "Finisată": { ru: "Чистовая отделка", en: "Finished Interior" },
  "Cămin": { ru: "Общежитие", en: "Dormitory" },
  "Garaj": { ru: "Гараж", en: "Garage" },
  "Convectoare": { ru: "Конвекторы", en: "Convectors" },
  "Pereți din Lut": { ru: "Глиняные стены", en: "Clay Walls" },
  "Cu Electrocasnice": { ru: "С бытовой техникой", en: "With Appliances" },
  "Pereți din panouri": { ru: "Панельные стены", en: "Panel Walls" },
  "Intrare separată": { ru: "Отдельный вход", en: "Separate Entrance" },
  "Construcție nefinisată": { ru: "Незавершённое строительство", en: "Unfinished Construction" },
  "Parcare sub boltă": { ru: "Крытая парковка", en: "Covered Parking" },
};


export function translateFeature(raw) {
  if (!raw) return "";
  const entry = FEATURE_MAP[raw] || FEATURE_MAP[String(raw).trim()];
  if (entry && _lang !== "ro") return entry[_lang] ?? raw;
  return raw;
}


export const ALL_FEATURES_RO = [
  "Reparație Cosmetică", "Metaloplast", "Parc", "Încălzire Autonomă",
  "Pereți din Cotileț", "În curs de reparație", "Pereți din Beton", "Ușă blindată",
  "Fără reparații", "Piață Alimentară", "Apartament tip „Hrușiovka\"", "Loc de joacă pentru copii",
  "Subsol/Cămară", "Spital/Policlinică", "Interfon", "Grădiniță",
  "Variantă Albă", "Variantă Gri", "Pereți de bloc", "Laminat",
  "Supermarket", "Pereți Combinați", "Aer condiționat", "Magazine",
  "Apartament Seria 143", "Linie Telefonică", "Apartament Seria 102", "Mobilată",
  "Parțial renovat", "Apartament Seria 135", "Încălzire Sobă", "Locuri de parcare",
  "Necesită renovare", "Sistem de semnalizare", "Bucătărie de vară", "Școală",
  "Bloc Nou", "Apartament tip „Individual\"", "Apartament tip „Rubașka\"", "Parcare publică",
  "Lift", "Cablu TV", "Anexă", "Pereți din Cărămidă",
  "Proiect Individual", "Podele încălzite", "Construcție spre demolare", "Reparație Euro",
  "Bucătărie", "Pereți Monolit", "Parcare subterană", "Termopan",
  "Cazan", "Finisată", "Cămin", "Garaj",
  "Convectoare", "Pereți din Lut", "Cu Electrocasnice", "Pereți din panouri",
  "Intrare separată", "Construcție nefinisată", "Parcare sub boltă",
];


export function getAllFeaturesSorted() {
  return ALL_FEATURES_RO
    .map(ro => ({ ro, display: translateFeature(ro) }))
    .sort((a, b) => a.display.localeCompare(b.display, _lang, { sensitivity: "base" }));
}


// ── Location name map
const LOCATION_MAP = {
  "România": { ro: "România", ru: "Румыния", en: "Romania" },
  "Turcia": { ro: "Turcia", ru: "Турция", en: "Turkey" },
  "Bulgaria": { ro: "Bulgaria", ru: "Болгария", en: "Bulgaria" },
  "Leova": { ro: "Leova", ru: "Леова", en: "Leova" },
  "Taraclia de Salcie": { ro: "Taraclia de Salcie", ru: "Тараклия де Салчие", en: "Taraclia de Salcie" },
  "Alexanderfeld": { ro: "Alexanderfeld", ru: "Александерфельд", en: "Alexanderfeld" },
  "Andrușul de Jos": { ro: "Andrușul de Jos", ru: "Андрушул де Жос", en: "Andrușul de Jos" },
  "Lebedenco": { ro: "Lebedenco", ru: "Лебеденко", en: "Lebedenco" },
  "Badicul Moldovenesc": { ro: "Badicul Moldovenesc", ru: "Бэдикул Молдовенеск", en: "Badicul Moldovenesc" },
  "Cucoara": { ro: "Cucoara", ru: "Кукоара", en: "Cucoara" },
  "Giurgiulești": { ro: "Giurgiulești", ru: "Джурджулешты", en: "Giurgiulești" },
  "Văleni": { ro: "Văleni", ru: "Вэлень", en: "Văleni" },
  "Huluboaia": { ro: "Huluboaia", ru: "Хулубоая", en: "Huluboaia" },
  "Vulcănești": { ro: "Vulcănești", ru: "Вулканешты", en: "Vulcănești" },
  "Pașcani": { ro: "Pașcani", ru: "Пашкань", en: "Pașcani" },
  "Italia": { ro: "Italia", ru: "Италия", en: "Italy" },
  "Colibași": { ro: "Colibași", ru: "Колибаший", en: "Colibași" },
  "Tartaul de Salcie": { ro: "Tartaul de Salcie", ru: "Тартаул де Салчие", en: "Tartaul de Salcie" },
  "Albota De Jos": { ro: "Albota de Jos", ru: "Альбота де Жос", en: "Albota de Jos" },
  "Albota De Sus": { ro: "Albota de Sus", ru: "Альбота де Сус", en: "Albota de Sus" },
  "Burlăceni": { ro: "Burlăceni", ru: "Бурлэчень", en: "Burlăceni" },
  "Basarabeasca": { ro: "Basarabeasca", ru: "Бессарабка", en: "Basarabeasca" },
  "Găvănoasa": { ro: "Găvănoasa", ru: "Гэвэноаса", en: "Găvănoasa" },
  "Moscovei": { ro: "Moscovei", ru: "Московей", en: "Moscovei" },
  "Ursoaia": { ro: "Ursoaia", ru: "Урсоая", en: "Ursoaia" },
  "Manta": { ro: "Manta", ru: "Манта", en: "Manta" },
  "Taraclia": { ro: "Taraclia", ru: "Тараклия", en: "Taraclia" },
  "Vadul lui Isac": { ro: "Vadul lui Isac", ru: "Вадул луй Исак", en: "Vadul lui Isac" },
  "Alexandru Ioan Cuza": { ro: "Alexandru Ioan Cuza", ru: "Александру Йоан Куза", en: "Alexandru Ioan Cuza" },
  "Bucuria": { ro: "Bucuria", ru: "Букурия", en: "Bucuria" },
  "Larga Nouă": { ro: "Larga Nouă", ru: "Ларга Ноуэ", en: "Larga Nouă" },
  "Gotești": { ro: "Gotești", ru: "Готешты", en: "Gotești" },
  "Crihana Veche": { ro: "Crihana Veche", ru: "Крихана Веке", en: "Crihana Veche" },
  "Cotihana": { ro: "Cotihana", ru: "Котихана", en: "Cotihana" },
  "Roșu": { ro: "Roșu", ru: "Рошу", en: "Roșu" },
  "Zîrnești": { ro: "Zîrnești", ru: "Зырнешть", en: "Zîrnești" },
  "Cantemir": { ro: "Cantemir", ru: "Кантемир", en: "Cantemir" },
  "Pelinei": { ro: "Pelinei", ru: "Пелиней", en: "Pelinei" },
  "Balabanu": { ro: "Balabanu", ru: "Балабану", en: "Balabanu" },
  "Andrușul de Sus": { ro: "Andrușul de Sus", ru: "Андрушул де Сус", en: "Andrușul de Sus" },
  "Albota de Jos": { ro: "Albota de Jos", ru: "Альбота де Жос", en: "Albota de Jos" },
  "Albota de Sus": { ro: "Albota de Sus", ru: "Альбота де Сус", en: "Albota de Sus" },
  "Cania": { ro: "Cania", ru: "Кания", en: "Cania" },
  "Cahul": { ro: "Cahul", ru: "Кагул", en: "Cahul" },
  "Centru-Policlinica": { ro: "Centru-Policlinica", ru: "Центр-Поликлиника", en: "Center-Polyclinic" },
  "Focșa": { ro: "Focșa", ru: "Фокша", en: "Focșa" },
  "Centru-str.Pușkin": { ro: "Centru-str.Pușkin", ru: "Центр-ул.Пушкина", en: "Center-Pushkin St." },
  "Spirin": { ro: "Spirin", ru: "Спирин", en: "Spirin" },
  "Centru-Baia Publică": { ro: "Centru-Baia Publică", ru: "Центр-Общественная баня", en: "Center-Public Bath" },
  "Lapaevca": { ro: "Lapaevca", ru: "Лапаевка", en: "Lapaevca" },
  "Fabrica de Vinuri": { ro: "Fabrica de Vinuri", ru: "Винзавод", en: "Winery District" },
  "Gebhardt": { ro: "Gebhardt", ru: "Гебхардт", en: "Gebhardt" },
  "Centru": { ro: "Centru", ru: "Центр", en: "Center" },
  "Autogara": { ro: "Autogara", ru: "Автовокзал", en: "Bus Station" },
  "Jubileu": { ro: "Jubileu", ru: "Юбилей", en: "Jubileu" },
  "Ghidro": { ro: "Ghidro", ru: "Гидро", en: "Ghidro" },
  "Lipovanca": { ro: "Lipovanca", ru: "Липованка", en: "Lipovanca" },
  "Calea Ferată": { ro: "Calea Ferată", ru: "Железная дорога", en: "Railway" },
  "Micro 15": { ro: "Micro 15", ru: "Микрорайон 15", en: "District 15" },
  "PMK 10": { ro: "PMK 10", ru: "ПМК 10", en: "PMK 10" },
  "Valincea": { ro: "Valincea", ru: "Валинча", en: "Valincea" },
  "Centru-Șurin Magazin": { ro: "Centru-Șurin Magazin", ru: "Центр-Магазин Шурин", en: "Center-Șurin Store" },
  "Centru-str.Creangă": { ro: "Centru-str.Creangă", ru: "Центр-ул.Крянгэ", en: "Center-Creangă St." }
};


export function translateLocation(raw) {
  if (!raw) return "";
  const entry = LOCATION_MAP[raw] || LOCATION_MAP[String(raw).trim()];
  if (entry) return entry[_lang] ?? entry.ro ?? raw;
  return raw;
}


export function translateRegionOptions() {
  document.querySelectorAll("select#region, select#e_region").forEach(sel => {
    sel.querySelectorAll("option[value]").forEach(opt => {
      const v = opt.value;
      if (!v) return;                    // skip the empty/disabled placeholder
      const translated = translateLocation(v);
      if (translated && translated !== v) opt.textContent = translated;
    });

    sel.querySelectorAll("optgroup").forEach(og => {
      const key = og.getAttribute("data-i18n");
      if (key) og.label = t(key);
    });
  });

  document.querySelectorAll(
    ".choices[data-id] .choices__item[data-value], " +
    ".choices__list .choices__item[data-value]"
  ).forEach(item => {
    const v = item.dataset.value;
    if (!v) return;
    const translated = translateLocation(v);
    if (translated && translated !== v) {

      const textNode = Array.from(item.childNodes).find(n => n.nodeType === 3);
      if (textNode) textNode.textContent = translated;
      else item.textContent = translated;
    }
  });
}

const CAHUL_SUBZONES_SET = new Set([
  "Cahul", "Centru-Policlinica", "Focșa", "Centru-str.Pușkin", "Spirin",
  "Centru-Baia Publică", "Lapaevca", "Fabrica de Vinuri", "Gebhardt",
  "Centru", "Autogara", "Jubileu", "Ghidro", "Lipovanca", "Calea Ferată",
  "Micro 15", "PMK 10", "Valincea", "Centru-Șurin Magazin", "Centru-str.Creangă",
]);


// ── Title generator
export function generateTitle(transactionType, propertyType, region) {
  if (!transactionType || !propertyType || !region) return "";
  const verb = transactionType === "rent" ? t("dash.title_verb_rent") : t("dash.title_verb_sale");
  const typeDisp = _lang === "ro" ? propertyType : translatePropertyTypeRaw(propertyType);

  const locDisp = translateLocation(region);
  const cahulDisp = translateLocation("Cahul");

  if (CAHUL_SUBZONES_SET.has(region)) {
    if (region === "Cahul") return `${verb} ${typeDisp}, ${locDisp}`;
    return `${verb} ${typeDisp}, ${cahulDisp}, ${locDisp}`;
  }
  return `${verb} ${typeDisp}, ${locDisp}`;
}

export function formatLocation(region) {
  if (!region) return "";
  const locDisp = translateLocation(region);
  const cahulDisp = translateLocation("Cahul");
  if (region === "Cahul") return locDisp;
  if (CAHUL_SUBZONES_SET.has(region)) return `${cahulDisp}, ${locDisp}`;
  return locDisp;
}
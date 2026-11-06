/**
 * NAICS Canada 2022 Version 1.0 sectors and subsectors, from Statistics Canada's published structure:
 * https://www.statcan.gc.ca/en/subjects/standard/naics/2022/v1/index
 */
export const NAICS_SECTORS: { code: string; title: string; subsectors: { code: string; title: string }[] }[] = [
  { code: "11", title: "Agriculture, forestry, fishing and hunting", subsectors: [
    { code: "111", title: "Crop production" },
    { code: "112", title: "Animal production and aquaculture" },
    { code: "113", title: "Forestry and logging" },
    { code: "114", title: "Fishing, hunting and trapping" },
    { code: "115", title: "Support activities for agriculture and forestry" },
  ] },
  { code: "21", title: "Mining, quarrying, and oil and gas extraction", subsectors: [
    { code: "211", title: "Oil and gas extraction" },
    { code: "212", title: "Mining and quarrying (except oil and gas)" },
    { code: "213", title: "Support activities for mining, and oil and gas extraction" },
  ] },
  { code: "22", title: "Utilities", subsectors: [
    { code: "221", title: "Utilities" },
  ] },
  { code: "23", title: "Construction", subsectors: [
    { code: "236", title: "Construction of buildings" },
    { code: "237", title: "Heavy and civil engineering construction" },
    { code: "238", title: "Specialty trade contractors" },
  ] },
  { code: "31-33", title: "Manufacturing", subsectors: [
    { code: "311", title: "Food manufacturing" },
    { code: "312", title: "Beverage and tobacco product manufacturing" },
    { code: "313", title: "Textile mills" },
    { code: "314", title: "Textile product mills" },
    { code: "315", title: "Apparel manufacturing" },
    { code: "316", title: "Leather and allied product manufacturing" },
    { code: "321", title: "Wood product manufacturing" },
    { code: "322", title: "Paper manufacturing" },
    { code: "323", title: "Printing and related support activities" },
    { code: "324", title: "Petroleum and coal product manufacturing" },
    { code: "325", title: "Chemical manufacturing" },
    { code: "326", title: "Plastics and rubber products manufacturing" },
    { code: "327", title: "Non-metallic mineral product manufacturing" },
    { code: "331", title: "Primary metal manufacturing" },
    { code: "332", title: "Fabricated metal product manufacturing" },
    { code: "333", title: "Machinery manufacturing" },
    { code: "334", title: "Computer and electronic product manufacturing" },
    { code: "335", title: "Electrical equipment, appliance and component manufacturing" },
    { code: "336", title: "Transportation equipment manufacturing" },
    { code: "337", title: "Furniture and related product manufacturing" },
    { code: "339", title: "Miscellaneous manufacturing" },
  ] },
  { code: "41", title: "Wholesale trade", subsectors: [
    { code: "411", title: "Farm product merchant wholesalers" },
    { code: "412", title: "Petroleum, petroleum products, and other hydrocarbons merchant wholesalers" },
    { code: "413", title: "Food, beverage and tobacco merchant wholesalers" },
    { code: "414", title: "Personal and household goods merchant wholesalers" },
    { code: "415", title: "Motor vehicle and motor vehicle parts and accessories merchant wholesalers" },
    { code: "416", title: "Building material and supplies merchant wholesalers" },
    { code: "417", title: "Machinery, equipment and supplies merchant wholesalers" },
    { code: "418", title: "Miscellaneous merchant wholesalers" },
    { code: "419", title: "Business-to-business electronic markets, and agents and brokers" },
  ] },
  { code: "44-45", title: "Retail trade", subsectors: [
    { code: "441", title: "Motor vehicle and parts dealers" },
    { code: "444", title: "Building material and garden equipment and supplies dealers" },
    { code: "445", title: "Food and beverage retailers" },
    { code: "449", title: "Furniture, home furnishings, electronics and appliances retailers" },
    { code: "455", title: "General merchandise retailers" },
    { code: "456", title: "Health and personal care retailers" },
    { code: "457", title: "Gasoline stations and fuel vendors" },
    { code: "458", title: "Clothing, clothing accessories, shoes, jewelry, luggage and leather goods retailers" },
    { code: "459", title: "Sporting goods, hobby, musical instrument, book, and miscellaneous retailers" },
  ] },
  { code: "48-49", title: "Transportation and warehousing", subsectors: [
    { code: "481", title: "Air transportation" },
    { code: "482", title: "Rail transportation" },
    { code: "483", title: "Water transportation" },
    { code: "484", title: "Truck transportation" },
    { code: "485", title: "Transit and ground passenger transportation" },
    { code: "486", title: "Pipeline transportation" },
    { code: "487", title: "Scenic and sightseeing transportation" },
    { code: "488", title: "Support activities for transportation" },
    { code: "491", title: "Postal service" },
    { code: "492", title: "Couriers and messengers" },
    { code: "493", title: "Warehousing and storage" },
  ] },
  { code: "51", title: "Information and cultural industries", subsectors: [
    { code: "512", title: "Motion picture and sound recording industries" },
    { code: "513", title: "Publishing industries" },
    { code: "516", title: "Broadcasting and content providers" },
    { code: "517", title: "Telecommunications" },
    { code: "518", title: "Computing infrastructure providers, data processing, web hosting, and related services" },
    { code: "519", title: "Web search portals, libraries, archives, and all other information services" },
  ] },
  { code: "52", title: "Finance and insurance", subsectors: [
    { code: "521", title: "Monetary authorities - central bank" },
    { code: "522", title: "Credit intermediation and related activities" },
    { code: "523", title: "Securities, commodity contracts, and other financial investment and related activities" },
    { code: "524", title: "Insurance carriers and related activities" },
    { code: "526", title: "Funds and other financial vehicles" },
  ] },
  { code: "53", title: "Real estate and rental and leasing", subsectors: [
    { code: "531", title: "Real estate" },
    { code: "532", title: "Rental and leasing services" },
    { code: "533", title: "Lessors of non-financial intangible assets (except copyrighted works)" },
  ] },
  { code: "54", title: "Professional, scientific and technical services", subsectors: [
    { code: "541", title: "Professional, scientific and technical services" },
  ] },
  { code: "55", title: "Management of companies and enterprises", subsectors: [
    { code: "551", title: "Management of companies and enterprises" },
  ] },
  { code: "56", title: "Administrative and support, waste management and remediation services", subsectors: [
    { code: "561", title: "Administrative and support services" },
    { code: "562", title: "Waste management and remediation services" },
  ] },
  { code: "61", title: "Educational services", subsectors: [
    { code: "611", title: "Educational services" },
  ] },
  { code: "62", title: "Health care and social assistance", subsectors: [
    { code: "621", title: "Ambulatory health care services" },
    { code: "622", title: "Hospitals" },
    { code: "623", title: "Nursing and residential care facilities" },
    { code: "624", title: "Social assistance" },
  ] },
  { code: "71", title: "Arts, entertainment and recreation", subsectors: [
    { code: "711", title: "Performing arts, spectator sports and related industries" },
    { code: "712", title: "Heritage institutions" },
    { code: "713", title: "Amusement, gambling and recreation industries" },
  ] },
  { code: "72", title: "Accommodation and food services", subsectors: [
    { code: "721", title: "Accommodation services" },
    { code: "722", title: "Food services and drinking places" },
  ] },
  { code: "81", title: "Other services (except public administration)", subsectors: [
    { code: "811", title: "Repair and maintenance" },
    { code: "812", title: "Personal and laundry services" },
    { code: "813", title: "Religious, grant-making, civic, and professional and similar organizations" },
    { code: "814", title: "Private households" },
  ] },
  { code: "91", title: "Public administration", subsectors: [
    { code: "911", title: "Federal government public administration" },
    { code: "912", title: "Provincial and territorial public administration" },
    { code: "913", title: "Local, municipal and regional public administration" },
    { code: "914", title: "Indigenous public administration" },
    { code: "919", title: "International and other extra-territorial public administration" },
  ] },
];
const SEPARATOR = ": ";

export type IndustryParts = { code: string; sector: string; subsector: string };

const BY_LABEL = new Map<string, IndustryParts>();
const BY_CODE = new Map<string, string>();
for (const sector of NAICS_SECTORS) {
  for (const sub of sector.subsectors) {
    const label = `${sector.title}${SEPARATOR}${sub.title}`;
    BY_LABEL.set(label, { code: sub.code, sector: sector.title, subsector: sub.title });
    BY_CODE.set(sub.code, label);
  }
}

/** The text saved as a company's industry. It keeps the sector, which fit scoring's keywords look for. */
export function industryLabelForCode(code: string): string | null {
  return BY_CODE.get(code) ?? null;
}

/** Null for anything outside the standard, such as raw license wording from a data sync. */
export function parseIndustry(value: string | null | undefined): IndustryParts | null {
  return value ? BY_LABEL.get(value) ?? null : null;
}

const OTHER_GROUP = "Other wording";

/** Filter options grouped by sector, for whichever industries are in use. */
export function industryOptions(values: string[], { wholeSectors = false } = {}): { value: string; label: string; group: string }[] {
  const options: { value: string; label: string; group: string }[] = [];
  const present = new Set(values);
  for (const sector of NAICS_SECTORS) {
    const inUse = sector.subsectors.map((s) => `${sector.title}${SEPARATOR}${s.title}`).filter((label) => present.has(label));
    if (inUse.length === 0) continue;
    if (wholeSectors) options.push({ value: `sector:${sector.title}`, label: `All of ${sector.title}`, group: sector.title });
    for (const label of inUse) options.push({ value: label, label: BY_LABEL.get(label)!.subsector, group: sector.title });
  }
  for (const value of [...present].filter((v) => !BY_LABEL.has(v)).sort()) options.push({ value, label: value, group: OTHER_GROUP });
  return options;
}

/** Whether a company's industry meets a filter, which can be one industry or a whole sector. */
export function matchesIndustryFilter(industry: string | null, filter: string): boolean {
  if (filter.startsWith("sector:")) return parseIndustry(industry)?.sector === filter.slice("sector:".length);
  return industry === filter;
}

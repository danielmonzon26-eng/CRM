import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { MappedLicense } from "@/lib/sources/calgary";
import { normalizeName } from "@/lib/text";

/**
 * Finds an existing company matching this license's business name + address, or
 * creates one. Intentionally simple exact-match dedupe for Step 3 — a business
 * appearing under slightly different spellings across licenses will create separate
 * company rows for now. Revisit with fuzzy matching if that turns out to matter once
 * real data is flowing.
 */
export async function matchOrCreateCompany(
  supabase: SupabaseClient<Database>,
  license: MappedLicense
): Promise<string> {
  const normalized = normalizeName(license.businessName);

  let query = supabase.from("companies").select("id").eq("normalized_name", normalized);
  query = license.address ? query.eq("address_line", license.address) : query.is("address_line", null);

  const { data: existing, error: findError } = await query.maybeSingle();
  if (findError) throw findError;
  if (existing) return existing.id;

  const { data: created, error: insertError } = await supabase
    .from("companies")
    .insert({
      name: license.businessName,
      normalized_name: normalized,
      address_line: license.address,
      community: license.community,
      industry: license.licenseType,
    })
    .select("id")
    .single();

  if (insertError) throw insertError;
  return created.id;
}

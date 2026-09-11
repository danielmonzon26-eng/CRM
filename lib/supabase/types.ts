/**
 * Hand-written to match supabase/migrations/0001_init_schema.sql.
 *
 * Once the Supabase CLI is linked with an access token, regenerate the exact
 * types instead of maintaining this by hand:
 *   npx supabase gen types typescript --project-id kteeooyybpwnnowkuwra > lib/supabase/types.ts
 */

export type LeadStatus =
  | "new"
  | "researching"
  | "contacted"
  | "qualified"
  | "unqualified"
  | "won"
  | "lost";

export type ActivityType =
  | "note"
  | "status_change"
  | "enrichment_run"
  | "email_sent"
  | "call_logged"
  | "sync_matched";

export type SourceKind = "open_data_api" | "web_scrape" | "enrichment";
export type SyncRunStatus = "running" | "success" | "failed";

export type Database = {
  public: {
    Tables: {
      sources: {
        Row: {
          id: string;
          key: string;
          name: string;
          kind: SourceKind;
          config: Record<string, unknown>;
          last_synced_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          key: string;
          name: string;
          kind: SourceKind;
          config?: Record<string, unknown>;
          last_synced_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["sources"]["Insert"]>;
      };
      companies: {
        Row: {
          id: string;
          name: string;
          normalized_name: string;
          website: string | null;
          domain: string | null;
          phone: string | null;
          address_line: string | null;
          city: string;
          province: string;
          postal_code: string | null;
          community: string | null;
          industry: string | null;
          naics_code: string | null;
          first_seen_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          normalized_name: string;
          website?: string | null;
          domain?: string | null;
          phone?: string | null;
          address_line?: string | null;
          city?: string;
          province?: string;
          postal_code?: string | null;
          community?: string | null;
          industry?: string | null;
          naics_code?: string | null;
          first_seen_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["companies"]["Insert"]>;
      };
      licenses: {
        Row: {
          id: string;
          source_id: string;
          company_id: string | null;
          external_id: string;
          business_name: string;
          license_type: string | null;
          license_status: string | null;
          description: string | null;
          issue_date: string | null;
          address: string | null;
          community: string | null;
          raw: Record<string, unknown>;
          fetched_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          source_id: string;
          company_id?: string | null;
          external_id: string;
          business_name: string;
          license_type?: string | null;
          license_status?: string | null;
          description?: string | null;
          issue_date?: string | null;
          address?: string | null;
          community?: string | null;
          raw?: Record<string, unknown>;
          fetched_at?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["licenses"]["Insert"]>;
      };
      leads: {
        Row: {
          id: string;
          company_id: string;
          status: LeadStatus;
          score: number;
          score_reasons: unknown[];
          assigned_to: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          status?: LeadStatus;
          score?: number;
          score_reasons?: unknown[];
          assigned_to?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["leads"]["Insert"]>;
      };
      contacts: {
        Row: {
          id: string;
          lead_id: string;
          full_name: string;
          title: string | null;
          email: string | null;
          email_confidence: number | null;
          phone: string | null;
          linkedin_url: string | null;
          source: string | null;
          is_primary: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          lead_id: string;
          full_name: string;
          title?: string | null;
          email?: string | null;
          email_confidence?: number | null;
          phone?: string | null;
          linkedin_url?: string | null;
          source?: string | null;
          is_primary?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["contacts"]["Insert"]>;
      };
      activities: {
        Row: {
          id: string;
          lead_id: string;
          actor_id: string | null;
          type: ActivityType;
          body: string | null;
          metadata: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          id?: string;
          lead_id: string;
          actor_id?: string | null;
          type: ActivityType;
          body?: string | null;
          metadata?: Record<string, unknown>;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["activities"]["Insert"]>;
      };
      sync_runs: {
        Row: {
          id: string;
          source_id: string;
          status: SyncRunStatus;
          started_at: string;
          finished_at: string | null;
          records_fetched: number;
          records_new: number;
          records_updated: number;
          error: string | null;
        };
        Insert: {
          id?: string;
          source_id: string;
          status?: SyncRunStatus;
          started_at?: string;
          finished_at?: string | null;
          records_fetched?: number;
          records_new?: number;
          records_updated?: number;
          error?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["sync_runs"]["Insert"]>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};

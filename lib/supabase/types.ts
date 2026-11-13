/**
 * Hand-written to match supabase/migrations/0001_init_schema.sql.
 *
 * Once the Supabase CLI is linked with an access token, regenerate the exact
 * types instead of maintaining this by hand:
 *   npx supabase gen types typescript --project-id kteeooyybpwnnowkuwra > lib/supabase/types.ts
 */

/** A lead's stage in the funnel (stored in leads.status). */
export type LeadStatus = "engagement" | "in_contact" | "discovery_meeting" | "pitch_meeting" | "proposal" | "client";

/** Whether the company is engaged (stored in leads.engagement; shown as "Status"). */
export type LeadEngagement = "engaged" | "not_engaged" | "do_not_contact";

export type ActivityType =
  | "note"
  | "status_change"
  | "enrichment_run"
  | "email_sent"
  | "call_logged"
  | "sync_matched"
  | "task_completed"
  | "deal_created"
  | "deal_stage_change"
  | "event_registration";

export type EventFormat = "in_person" | "online" | "hybrid";
export type EventStatus = "draft" | "published" | "cancelled";
export type EventTicketType = "free" | "paid";
export type AttendanceMode = "in_person" | "online";
export type RegistrationStatus = "registered" | "waitlisted" | "cancelled";
export type PaymentStatus = "not_required" | "unpaid" | "paid" | "refunded";
export type AgendaItem = { time: string; title: string };
export type Speaker = { name: string; title: string };
export type EventResourceKind = "document" | "video";
export type BudgetLineKind = "general" | "event";
export type ExpenseStatus = "committed" | "actual";

export type SourceKind = "open_data_api" | "web_scrape" | "enrichment";
export type SyncRunStatus = "running" | "success" | "failed";
export type UserRole = "admin" | "rep";
export type TaskType = "todo" | "call" | "email" | "meeting";

export type BudgetRevenueKind = "grant" | "sponsorship" | "other";
export type BudgetRevenueStatus = "pending" | "approved" | "received" | "declined";
export type MailAccountStatus = "connected" | "needs_reconnect";
export type EmailDirection = "inbound" | "outbound";

export type DealStage = "in_development" | "sent" | "accepted" | "declined";
export type DealPayment = "paid" | "unpaid";
export type NoteKind = "note" | "call" | "meeting" | "email";
export type SocialPlatform = "linkedin" | "facebook" | "instagram";
export type SocialPostStatus = "requested" | "waiting_approval" | "approved";

// supabase-js's generated-types contract expects each table to declare its foreign-key
// relationships (used for typed nested `select()` joins). None are modeled by hand here.
type NoRelationships = { Relationships: [] };

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
        Relationships: [];
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
          estimated_annual_revenue: number | null;
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
          estimated_annual_revenue?: number | null;
          first_seen_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["companies"]["Insert"]>;
        Relationships: [];
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
          is_home_based: boolean | null;
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
          is_home_based?: boolean | null;
          raw?: Record<string, unknown>;
          fetched_at?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["licenses"]["Insert"]>;
        Relationships: [];
      };
      leads: {
        Row: {
          id: string;
          company_id: string;
          status: LeadStatus;
          engagement: LeadEngagement;
          bmc_score: number | null;
          score: number;
          score_reasons: unknown[];
          assigned_to: string | null;
          deal_value: number | null;
          expected_close_date: string | null;
          client_type: string | null;
          programs: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          client_type?: string | null;
          programs?: string[];
          status?: LeadStatus;
          engagement?: LeadEngagement;
          score?: number;
          score_reasons?: unknown[];
          assigned_to?: string | null;
          deal_value?: number | null;
          expected_close_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["leads"]["Insert"]>;
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
      };
      tasks: {
        Row: {
          id: string;
          lead_id: string | null;
          company_id: string | null;
          event_id: string | null;
          title: string;
          description: string | null;
          task_type: TaskType;
          due_at: string | null;
          completed_at: string | null;
          assigned_to: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          lead_id?: string | null;
          company_id?: string | null;
          event_id?: string | null;
          title: string;
          description?: string | null;
          task_type?: TaskType;
          due_at?: string | null;
          completed_at?: string | null;
          assigned_to?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["tasks"]["Insert"]>;
        Relationships: [];
      };
      deals: {
        Row: {
          id: string;
          lead_id: string | null;
          company_id: string;
          primary_contact_id: string | null;
          name: string;
          owner: string | null;
          pipeline: string;
          stage: DealStage;
          amount: number;
          currency: string;
          expected_close_date: string;
          probability: number | null;
          lead_source: string | null;
          next_step: string | null;
          next_step_due_date: string | null;
          last_activity_at: string | null;
          competitors: string | null;
          lost_reason: string | null;
          closed_at: string | null;
          notes: string | null;
          work_types: string[];
          payment: DealPayment | null;
          sent_on: string | null;
          accepted_on: string | null;
          request_key: string | null;
          declined_by: "them" | "us" | null;
          declined_reason: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          lead_id?: string | null;
          company_id: string;
          primary_contact_id?: string | null;
          name: string;
          owner?: string | null;
          pipeline?: string;
          stage?: DealStage;
          amount: number;
          currency?: string;
          expected_close_date: string;
          probability?: number | null;
          lead_source?: string | null;
          next_step?: string | null;
          next_step_due_date?: string | null;
          last_activity_at?: string | null;
          competitors?: string | null;
          lost_reason?: string | null;
          closed_at?: string | null;
          notes?: string | null;
          work_types?: string[];
          payment?: DealPayment | null;
          sent_on?: string | null;
          accepted_on?: string | null;
          request_key?: string | null;
          declined_by?: "them" | "us" | null;
          declined_reason?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["deals"]["Insert"]>;
        Relationships: [];
      };
      deal_stage_history: {
        Row: {
          id: string;
          deal_id: string;
          from_stage: DealStage | null;
          to_stage: DealStage;
          changed_by: string | null;
          changed_at: string;
        };
        Insert: {
          id?: string;
          deal_id: string;
          from_stage?: DealStage | null;
          to_stage: DealStage;
          changed_by?: string | null;
          changed_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["deal_stage_history"]["Insert"]>;
        Relationships: [];
      };
      lead_notes: {
        Row: {
          id: string;
          lead_id: string;
          company_id: string;
          contact_id: string | null;
          kind: NoteKind;
          body: string;
          occurred_at: string;
          pinned: boolean;
          created_by: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          lead_id: string;
          company_id: string;
          contact_id?: string | null;
          kind?: NoteKind;
          body: string;
          occurred_at?: string;
          pinned?: boolean;
          created_by?: string | null;
          updated_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["lead_notes"]["Insert"]>;
        Relationships: [];
      };
      event_feedback: {
        Row: {
          id: string;
          event_id: string;
          registration_id: string | null;
          token: string;
          full_name: string | null;
          email: string | null;
          request_sent_at: string | null;
          send_error: string | null;
          submitted_at: string | null;
          satisfaction: number | null;
          recommend: number | null;
          topics: string[];
          most_valuable: string | null;
          improve: string | null;
          follow_up: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          registration_id?: string | null;
          token?: string;
          full_name?: string | null;
          email?: string | null;
          request_sent_at?: string | null;
          send_error?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["event_feedback"]["Insert"]>;
        Relationships: [];
      };
      discovery_calls: {
        Row: {
          id: string;
          lead_id: string;
          company_id: string;
          contact_id: string | null;
          prospect_name: string | null;
          call_date: string;
          include_expansion: boolean;
          answers: Record<string, string>;
          block_status: Record<string, string>;
          score: number;
          consultant_experience: string | null;
          consultant_notes: string | null;
          pricing_discussed: boolean | null;
          decision_maker_present: boolean | null;
          flags: string[];
          recommended_entry: string | null;
          entry_reason: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          lead_id: string;
          company_id: string;
          contact_id?: string | null;
          prospect_name?: string | null;
          call_date?: string;
          include_expansion?: boolean;
          answers?: Record<string, string>;
          block_status?: Record<string, string>;
          score?: number;
          consultant_experience?: string | null;
          consultant_notes?: string | null;
          pricing_discussed?: boolean | null;
          decision_maker_present?: boolean | null;
          flags?: string[];
          recommended_entry?: string | null;
          entry_reason?: string | null;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["discovery_calls"]["Insert"]>;
        Relationships: [];
      };
      deal_people: {
        Row: { deal_id: string; contact_id: string; role: string; created_at: string };
        Insert: { deal_id: string; contact_id: string; role: string };
        Update: Partial<Database["public"]["Tables"]["deal_people"]["Insert"]>;
        Relationships: [];
      };
      marketing_channels: {
        Row: { id: string; platform: SocialPlatform; name: string; handle: string | null; active: boolean; sort_order: number; created_at: string; updated_at: string };
        Insert: { id?: string; platform: SocialPlatform; name: string; handle?: string | null; active?: boolean; sort_order?: number };
        Update: Partial<Database["public"]["Tables"]["marketing_channels"]["Insert"]>;
        Relationships: [];
      };
      marketing_promotions: {
        Row: {
          id: string;
          event_id: string;
          post_id: string | null;
          kind: "boost" | "ad";
          name: string;
          platforms: SocialPlatform[];
          starts_on: string;
          ends_on: string;
          amount: number;
          spent: number;
          status: "planned" | "running" | "done";
          suggested: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          post_id?: string | null;
          kind?: "boost" | "ad";
          name: string;
          platforms?: SocialPlatform[];
          starts_on: string;
          ends_on: string;
          amount?: number;
          spent?: number;
          status?: "planned" | "running" | "done";
          suggested?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["marketing_promotions"]["Insert"]>;
        Relationships: [];
      };
      marketing_items: {
        Row: {
          id: string;
          stream: "catapult" | "event" | "sponsorship";
          item_type: "social" | "online_advertising" | "production" | "creative" | "event_materials" | "onsite_advertising";
          description: string;
          event_id: string | null;
          sponsor_company_id: string | null;
          amount: number;
          budget_line_id: string | null;
          budget_item_id: string | null;
          delivery_timing: string | null;
          delivery_on: string | null;
          status: "planned" | "in_progress" | "done";
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          stream: "catapult" | "event" | "sponsorship";
          item_type: "social" | "online_advertising" | "production" | "creative" | "event_materials" | "onsite_advertising";
          description?: string;
          event_id?: string | null;
          sponsor_company_id?: string | null;
          amount?: number;
          budget_line_id?: string | null;
          delivery_timing?: string | null;
          delivery_on?: string | null;
          status?: "planned" | "in_progress" | "done";
        };
        Update: Partial<Database["public"]["Tables"]["marketing_items"]["Insert"]>;
        Relationships: [];
      };
      marketing_initiatives: {
        Row: {
          id: string;
          name: string;
          objective: string | null;
          owner_id: string | null;
          event_id: string | null;
          starts_on: string | null;
          ends_on: string | null;
          budget: number | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          objective?: string | null;
          owner_id?: string | null;
          event_id?: string | null;
          starts_on?: string | null;
          ends_on?: string | null;
          budget?: number | null;
        };
        Update: Partial<Database["public"]["Tables"]["marketing_initiatives"]["Insert"]>;
        Relationships: [];
      };
      social_posts: {
        Row: {
          id: string;
          initiative_id: string | null;
          title: string;
          caption: string;
          scheduled_at: string | null;
          status: SocialPostStatus;
          image_path: string | null;
          image_name: string | null;
          review_note: string | null;
          event_id: string | null;
          auto_days_before: number | null;
          event_days_before: number | null;
          created_by: string | null;
          submitted_at: string | null;
          approved_by: string | null;
          approved_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          initiative_id?: string | null;
          title: string;
          caption?: string;
          scheduled_at?: string | null;
          status?: SocialPostStatus;
          image_path?: string | null;
          image_name?: string | null;
          review_note?: string | null;
          event_id?: string | null;
          event_days_before?: number | null;
          auto_days_before?: number | null;
        };
        Update: Partial<Database["public"]["Tables"]["social_posts"]["Insert"]>;
        Relationships: [];
      };
      social_post_channels: {
        Row: { post_id: string; channel_id: string };
        Insert: { post_id: string; channel_id: string };
        Update: Partial<Database["public"]["Tables"]["social_post_channels"]["Insert"]>;
        Relationships: [];
      };
      event_programs: {
        Row: { id: string; name: string; sort_order: number; created_at: string };
        Insert: { id?: string; name: string; sort_order?: number };
        Update: Partial<Database["public"]["Tables"]["event_programs"]["Insert"]>;
        Relationships: [];
      };
      email_seen: {
        Row: { user_id: string; email_id: string; seen_at: string };
        Insert: { user_id?: string; email_id: string; seen_at?: string };
        Update: Partial<Database["public"]["Tables"]["email_seen"]["Insert"]>;
        Relationships: [];
      };
      deal_staff: {
        Row: { deal_id: string; user_id: string; created_at: string };
        Insert: { deal_id: string; user_id: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["deal_staff"]["Insert"]>;
        Relationships: [];
      };
      deal_files: {
        Row: {
          id: string;
          deal_id: string;
          file_name: string;
          storage_path: string;
          size_bytes: number | null;
          content_type: string | null;
          uploaded_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          deal_id: string;
          file_name: string;
          storage_path: string;
          size_bytes?: number | null;
          content_type?: string | null;
          uploaded_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["deal_files"]["Insert"]>;
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          email: string | null;
          full_name: string | null;
          role: UserRole;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          full_name?: string | null;
          role?: UserRole;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      events: {
        Row: {
          id: string;
          slug: string;
          title: string;
          event_type: string | null;
          description: string | null;
          image_url: string | null;
          format: EventFormat;
          venue_name: string | null;
          venue_address: string | null;
          online_url: string | null;
          starts_at: string;
          ends_at: string | null;
          capacity: number | null;
          target_attendees: number | null;
          program: string | null;
          owner_id: string | null;
          archived_at: string | null;
          agenda: AgendaItem[];
          speakers: Speaker[];
          collect_company: boolean;
          collect_phone: boolean;
          waitlist_enabled: boolean;
          registration_opens_at: string | null;
          registration_closes_at: string | null;
          confirmation_message: string | null;
          budget_amount: number | null;
          funding_source: string | null;
          budget_notes: string | null;
          ticket_type: EventTicketType;
          ticket_price: number | null;
          currency: string;
          status: EventStatus;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          registration_questions: unknown;
        };
        Insert: {
          id?: string;
          slug: string;
          title: string;
          event_type?: string | null;
          description?: string | null;
          image_url?: string | null;
          format?: EventFormat;
          venue_name?: string | null;
          venue_address?: string | null;
          online_url?: string | null;
          starts_at: string;
          ends_at?: string | null;
          capacity?: number | null;
          target_attendees?: number | null;
          program?: string | null;
          owner_id?: string | null;
          archived_at?: string | null;
          agenda?: AgendaItem[];
          speakers?: Speaker[];
          collect_company?: boolean;
          collect_phone?: boolean;
          waitlist_enabled?: boolean;
          registration_opens_at?: string | null;
          registration_closes_at?: string | null;
          confirmation_message?: string | null;
          budget_amount?: number | null;
          funding_source?: string | null;
          budget_notes?: string | null;
          ticket_type?: EventTicketType;
          ticket_price?: number | null;
          currency?: string;
          status?: EventStatus;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          registration_questions?: unknown;
        };
        Update: Partial<Database["public"]["Tables"]["events"]["Insert"]>;
        Relationships: [];
      };
      budgets: {
        Row: {
          id: string;
          name: string;
          period_label: string | null;
          source_file: string | null;
          start_month: string | null;
          end_month: string | null;
          notes: string | null;
          total_amount: number | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          period_label?: string | null;
          source_file?: string | null;
          start_month?: string | null;
          end_month?: string | null;
          notes?: string | null;
          total_amount?: number | null;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["budgets"]["Insert"]>;
        Relationships: [];
      };
      budget_lines: {
        Row: {
          id: string;
          budget_id: string;
          kind: BudgetLineKind;
          section: string;
          name: string;
          amount: number;
          event_id: string | null;
          plan_month: string | null;
          owner_name: string | null;
          notes: string | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
          planned_amount: number | null;
        };
        Insert: {
          id?: string;
          budget_id: string;
          kind: BudgetLineKind;
          section: string;
          name: string;
          amount?: number;
          event_id?: string | null;
          plan_month?: string | null;
          owner_name?: string | null;
          notes?: string | null;
          sort_order?: number;
          planned_amount?: number | null;
        };
        Update: Partial<Database["public"]["Tables"]["budget_lines"]["Insert"]>;
        Relationships: [];
      };
      budget_allocations: {
        Row: {
          line_id: string;
          month: string;
          amount: number;
        };
        Insert: {
          line_id: string;
          month: string;
          amount?: number;
        };
        Update: Partial<Database["public"]["Tables"]["budget_allocations"]["Insert"]>;
        Relationships: [];
      };
      budget_items: {
        Row: {
          id: string;
          line_id: string;
          name: string;
          amount: number;
          notes: string | null;
          sort_order: number;
          updated_at: string;
          marketing_category: string | null;
          delivery_timing: string | null;
          delivery_on: string | null;
          delivered_at: string | null;
        };
        Insert: {
          id?: string;
          line_id: string;
          name: string;
          amount?: number;
          notes?: string | null;
          sort_order?: number;
          marketing_category?: string | null;
          delivery_timing?: string | null;
          delivery_on?: string | null;
          delivered_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["budget_items"]["Insert"]>;
        Relationships: [];
      };
      budget_revenue: {
        Row: {
          id: string;
          budget_id: string;
          kind: BudgetRevenueKind;
          source: string;
          amount: number;
          status: BudgetRevenueStatus;
          expected_on: string;
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          budget_id: string;
          kind: BudgetRevenueKind;
          source: string;
          amount: number;
          status?: BudgetRevenueStatus;
          expected_on: string;
          notes?: string | null;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["budget_revenue"]["Insert"]>;
        Relationships: [];
      };
      budget_expenses: {
        Row: {
          id: string;
          line_id: string;
          item_id: string | null;
          status: ExpenseStatus;
          amount: number;
          incurred_on: string;
          vendor: string | null;
          description: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          line_id: string;
          item_id?: string | null;
          status?: ExpenseStatus;
          amount: number;
          incurred_on: string;
          vendor?: string | null;
          description?: string | null;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["budget_expenses"]["Insert"]>;
        Relationships: [];
      };
      event_revenue: {
        Row: {
          id: string;
          event_id: string;
          source: string;
          amount: number;
          received_on: string | null;
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          source: string;
          amount: number;
          received_on?: string | null;
          notes?: string | null;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["event_revenue"]["Insert"]>;
        Relationships: [];
      };
      budget_changes: {
        Row: {
          id: string;
          budget_id: string | null;
          line_id: string | null;
          table_name: string;
          action: "insert" | "update" | "delete";
          before_data: Record<string, unknown> | null;
          after_data: Record<string, unknown> | null;
          changed_by: string | null;
          changed_at: string;
        };
        Insert: {
          id?: string;
          budget_id?: string | null;
          line_id?: string | null;
          table_name: string;
          action: "insert" | "update" | "delete";
          before_data?: Record<string, unknown> | null;
          after_data?: Record<string, unknown> | null;
          changed_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["budget_changes"]["Insert"]>;
        Relationships: [];
      };
      event_templates: {
        Row: {
          id: string;
          name: string;
          data: Record<string, unknown>;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          data?: Record<string, unknown>;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["event_templates"]["Insert"]>;
        Relationships: [];
      };
      event_registrations: {
        Row: {
          id: string;
          event_id: string;
          lead_id: string | null;
          contact_id: string | null;
          full_name: string;
          email: string;
          phone: string | null;
          company_name: string | null;
          attendance_mode: AttendanceMode;
          status: RegistrationStatus;
          checked_in_at: string | null;
          ticket_code: string;
          payment_status: PaymentStatus;
          amount_due: number | null;
          amount_paid: number | null;
          currency: string | null;
          stripe_checkout_session_id: string | null;
          stripe_payment_intent_id: string | null;
          paid_at: string | null;
          created_at: string;
          updated_at: string;
          answers: unknown;
        };
        Insert: {
          id?: string;
          event_id: string;
          lead_id?: string | null;
          contact_id?: string | null;
          full_name: string;
          email: string;
          phone?: string | null;
          company_name?: string | null;
          attendance_mode: AttendanceMode;
          status?: RegistrationStatus;
          checked_in_at?: string | null;
          ticket_code?: string;
          payment_status?: PaymentStatus;
          amount_due?: number | null;
          amount_paid?: number | null;
          currency?: string | null;
          stripe_checkout_session_id?: string | null;
          stripe_payment_intent_id?: string | null;
          paid_at?: string | null;
          created_at?: string;
          updated_at?: string;
          answers?: unknown;
        };
        Update: Partial<Database["public"]["Tables"]["event_registrations"]["Insert"]>;
        Relationships: [];
      };
      event_resources: {
        Row: {
          id: string;
          event_id: string;
          kind: EventResourceKind;
          title: string;
          storage_path: string | null;
          url: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          kind: EventResourceKind;
          title: string;
          storage_path?: string | null;
          url?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["event_resources"]["Insert"]>;
        Relationships: [];
      };
      mail_accounts: {
        Row: {
          id: string;
          user_id: string;
          email: string;
          display_name: string | null;
          refresh_token: string;
          status: MailAccountStatus;
          inbox_sync_link: string | null;
          sent_sync_link: string | null;
          last_synced_at: string | null;
          sync_started_at: string | null;
          last_error: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          email: string;
          display_name?: string | null;
          refresh_token: string;
          status?: MailAccountStatus;
          inbox_sync_link?: string | null;
          sent_sync_link?: string | null;
          last_synced_at?: string | null;
          sync_started_at?: string | null;
          last_error?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["mail_accounts"]["Insert"]>;
        Relationships: [];
      };
      emails: {
        Row: {
          id: string;
          account_id: string;
          graph_id: string;
          conversation_id: string | null;
          direction: EmailDirection;
          from_email: string | null;
          from_name: string | null;
          to_emails: string[];
          cc_emails: string[];
          participants: string[];
          subject: string | null;
          preview: string | null;
          body: string | null;
          sent_at: string;
          is_read: boolean;
          has_attachments: boolean;
          web_link: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          graph_id: string;
          conversation_id?: string | null;
          direction: EmailDirection;
          from_email?: string | null;
          from_name?: string | null;
          to_emails?: string[];
          cc_emails?: string[];
          participants?: string[];
          subject?: string | null;
          preview?: string | null;
          body?: string | null;
          sent_at: string;
          is_read?: boolean;
          has_attachments?: boolean;
          web_link?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["emails"]["Insert"]>;
        Relationships: [];
      };
      meetings: {
        Row: {
          id: string;
          account_id: string;
          graph_id: string;
          subject: string | null;
          starts_at: string;
          ends_at: string;
          is_all_day: boolean;
          location: string | null;
          online_url: string | null;
          organizer_email: string | null;
          participants: string[];
          web_link: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          graph_id: string;
          subject?: string | null;
          starts_at: string;
          ends_at: string;
          is_all_day?: boolean;
          location?: string | null;
          online_url?: string | null;
          organizer_email?: string | null;
          participants?: string[];
          web_link?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["meetings"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      import_budget: {
        Args: { p_budget: Record<string, unknown> };
        Returns: string;
      };
      crm_search_leads: {
        Args: {
          p_search?: string | null;
          p_statuses?: string[] | null;
          p_engagement?: string | null;
          p_industry?: string | null;
          p_community?: string | null;
          p_min_score?: number | null;
          p_contact?: string | null;
          p_event_id?: string | null;
          p_client_type?: string | null;
          p_program?: string | null;
          p_proposal?: string | null;
          p_view?: string | null;
          p_sort?: string;
          p_descending?: boolean;
          p_limit?: number;
          p_offset?: number;
        };
        Returns: {
          id: string;
          status: string;
          engagement: string;
          score: number;
          assigned_to: string | null;
          created_at: string;
          company_id: string;
          company_name: string;
          community: string | null;
          industry: string | null;
          client_type: string | null;
          programs: string[];
          primary_name: string | null;
          primary_title: string | null;
          primary_email: string | null;
          primary_contact_id: string | null;
          contact_count: number;
          proposal_id: string | null;
          proposal_stage: string | null;
          last_touch_at: string | null;
          awaiting_us: boolean;
          overdue: boolean;
          total_count: number;
        }[];
      };
      crm_lead_view_counts: {
        Args: {
          p_search?: string | null;
          p_statuses?: string[] | null;
          p_engagement?: string | null;
          p_industry?: string | null;
          p_community?: string | null;
          p_min_score?: number | null;
          p_contact?: string | null;
          p_event_id?: string | null;
          p_client_type?: string | null;
          p_program?: string | null;
          p_proposal?: string | null;
        };
        Returns: { view: string; lead_count: number }[];
      };
      crm_lead_stage_counts: {
        Args: {
          p_search?: string | null;
          p_engagement?: string | null;
          p_industry?: string | null;
          p_community?: string | null;
          p_min_score?: number | null;
          p_contact?: string | null;
          p_event_id?: string | null;
          p_client_type?: string | null;
          p_program?: string | null;
          p_proposal?: string | null;
          p_view?: string | null;
        };
        Returns: { status: string; lead_count: number; open_value: number }[];
      };
      crm_change_lead_program: {
        Args: { p_lead_ids: string[]; p_program: string; p_add: boolean };
        Returns: number;
      };
      crm_lead_facets: {
        Args: Record<string, never>;
        Returns: { industries: string[]; communities: string[] };
      };
      move_event_budget_line: {
        Args: { p_event_id: string; p_to_line: string };
        Returns: undefined;
      };
      budget_add_line: {
        Args: { p_budget_id: string; p_kind: string; p_section: string; p_name: string; p_plan_month?: string | null };
        Returns: string;
      };
      budget_add_months: {
        Args: { p_budget_id: string; p_months: string[] };
        Returns: undefined;
      };
      budget_add_month: {
        Args: { p_budget_id: string; p_month: string };
        Returns: undefined;
      };
      get_public_event: {
        Args: { p_slug: string };
        Returns: {
          title: string;
          program: string | null;
          event_type: string | null;
          description: string | null;
          image_url: string | null;
          format: EventFormat;
          venue_name: string | null;
          venue_address: string | null;
          starts_at: string;
          ends_at: string | null;
          agenda: AgendaItem[];
          speakers: Speaker[];
          collect_company: boolean;
          collect_phone: boolean;
          waitlist_enabled: boolean;
          registration_opens_at: string | null;
          registration_closes_at: string | null;
          ticket_type: EventTicketType;
          ticket_price: number | null;
          currency: string;
          status: EventStatus;
          spots_remaining: number | null;
        }[];
      };
      get_feedback_form: {
        Args: { p_token: string };
        Returns: { event_title: string; starts_at: string; first_name: string; submitted: boolean }[];
      };
      submit_event_feedback: {
        Args: {
          p_token: string;
          p_satisfaction: number;
          p_recommend: number;
          p_topics: string[];
          p_most_valuable: string | null;
          p_improve: string | null;
          p_follow_up: string | null;
        };
        Returns: "ok" | "invalid" | "already";
      };
      register_for_event: {
        Args: {
          p_slug: string;
          p_full_name: string;
          p_email: string;
          p_phone?: string | null;
          p_company?: string | null;
          p_attendance_mode?: string | null;
        };
        Returns: {
          status:
            | "registered"
            | "waitlisted"
            | "payment_pending"
            | "already_registered"
            | "sold_out"
            | "closed"
            | "not_open"
            | "not_found"
            | "invalid";
          ticket_code?: string;
          online_url?: string | null;
          confirmation_message?: string | null;
          payment_required?: boolean;
          amount_due?: number | null;
          currency?: string | null;
        };
      };
      unseen_reply_ids: { Args: Record<string, never>; Returns: string[] };
      is_admin: { Args: Record<string, never>; Returns: boolean };
      unseen_reply_count: { Args: Record<string, never>; Returns: number };
      mark_all_emails_seen: { Args: Record<string, never>; Returns: number };
      get_registration_questions: { Args: { p_slug: string }; Returns: unknown };
      save_registration_answers: { Args: { p_ticket: string; p_answers: unknown }; Returns: boolean };
    };
    Enums: Record<string, never>;
  };
};

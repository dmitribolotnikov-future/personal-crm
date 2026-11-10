DO $$
BEGIN
  IF nullif(current_setting('crm.legacy_owner_email', true), '') IS NULL THEN
    RAISE EXCEPTION 'LEGACY_OWNER_EMAIL must be supplied through the migration entry point';
  END IF;
END $$;
--> statement-breakpoint
CREATE TABLE "auth_account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "magic_link_requests" (
	"email" text PRIMARY KEY NOT NULL,
	"current_token_digest" text,
	"recent_send_times" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "magic_link_tokens" (
	"digest" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"user_id" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "auth_user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_user_email_unique" UNIQUE("email"),
	CONSTRAINT "auth_user_normalized_email_check" CHECK ("auth_user"."email" = lower(btrim("auth_user"."email")))
);
--> statement-breakpoint
CREATE TABLE "auth_verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contact_groups" DROP CONSTRAINT "contact_groups_normalized_name_unique";--> statement-breakpoint
ALTER TABLE "contact_group_memberships" ADD COLUMN "owner_id" text;--> statement-breakpoint
ALTER TABLE "contact_groups" ADD COLUMN "owner_id" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "owner_id" text;--> statement-breakpoint
DO $$
DECLARE
  owner_email text := current_setting('crm.legacy_owner_email');
  legacy_owner_id text;
BEGIN
  INSERT INTO auth_user (id, email) VALUES (gen_random_uuid()::text, owner_email)
    ON CONFLICT (email) DO NOTHING;
  SELECT id INTO STRICT legacy_owner_id FROM auth_user WHERE email = owner_email;
  UPDATE contacts SET owner_id = legacy_owner_id WHERE owner_id IS NULL;
  UPDATE contact_groups SET owner_id = legacy_owner_id WHERE owner_id IS NULL;
  UPDATE contact_group_memberships SET owner_id = legacy_owner_id WHERE owner_id IS NULL;
END $$;
--> statement-breakpoint
ALTER TABLE "contacts" ALTER COLUMN "owner_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "contact_groups" ALTER COLUMN "owner_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "contact_group_memberships" ALTER COLUMN "owner_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "contact_groups" ADD CONSTRAINT "contact_groups_owner_name_unique" UNIQUE("owner_id","normalized_name");--> statement-breakpoint
ALTER TABLE "contact_groups" ADD CONSTRAINT "contact_groups_owner_id_id_unique" UNIQUE("owner_id","id");--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_owner_id_id_unique" UNIQUE("owner_id","id");--> statement-breakpoint
ALTER TABLE "auth_account" ADD CONSTRAINT "auth_account_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "magic_link_tokens" ADD CONSTRAINT "magic_link_tokens_email_magic_link_requests_email_fk" FOREIGN KEY ("email") REFERENCES "public"."magic_link_requests"("email") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_session" ADD CONSTRAINT "auth_session_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auth_account_user_id_idx" ON "auth_account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "magic_link_tokens_expiry_idx" ON "magic_link_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "auth_session_user_id_idx" ON "auth_session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "auth_verification_identifier_idx" ON "auth_verification" USING btree ("identifier");--> statement-breakpoint
ALTER TABLE "contact_group_memberships" ADD CONSTRAINT "memberships_owner_contact_fk" FOREIGN KEY ("owner_id","contact_id") REFERENCES "public"."contacts"("owner_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_group_memberships" ADD CONSTRAINT "memberships_owner_group_fk" FOREIGN KEY ("owner_id","group_id") REFERENCES "public"."contact_groups"("owner_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_groups" ADD CONSTRAINT "contact_groups_owner_id_auth_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."auth_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_owner_id_auth_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."auth_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "memberships_owner_group_idx" ON "contact_group_memberships" USING btree ("owner_id","group_id");--> statement-breakpoint
CREATE INDEX "contacts_owner_id_idx" ON "contacts" USING btree ("owner_id");

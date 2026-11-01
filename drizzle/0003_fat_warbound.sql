CREATE TABLE "contact_group_memberships" (
	"contact_id" integer NOT NULL,
	"group_id" integer NOT NULL,
	CONSTRAINT "contact_group_memberships_contact_id_group_id_pk" PRIMARY KEY("contact_id","group_id")
);
--> statement-breakpoint
CREATE TABLE "contact_groups" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "contact_groups_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contact_groups_normalized_name_unique" UNIQUE("normalized_name"),
	CONSTRAINT "contact_groups_name_check" CHECK (length(btrim("contact_groups"."name")) > 0)
);
--> statement-breakpoint
ALTER TABLE "contact_group_memberships" ADD CONSTRAINT "contact_group_memberships_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_group_memberships" ADD CONSTRAINT "contact_group_memberships_group_id_contact_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."contact_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contact_group_memberships_group_id_idx" ON "contact_group_memberships" USING btree ("group_id");
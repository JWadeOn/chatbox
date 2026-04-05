CREATE TABLE "study_decks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"cards" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"card_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "study_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"deck_id" uuid NOT NULL,
	"session_id" uuid,
	"cards_seen" integer DEFAULT 0 NOT NULL,
	"cards_correct" integer DEFAULT 0 NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "study_decks" ADD CONSTRAINT "study_decks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_progress" ADD CONSTRAINT "study_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_progress" ADD CONSTRAINT "study_progress_deck_id_study_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "public"."study_decks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_progress" ADD CONSTRAINT "study_progress_session_id_app_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."app_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_study_decks_user" ON "study_decks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_study_progress_user" ON "study_progress" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_study_progress_deck" ON "study_progress" USING btree ("deck_id");--> statement-breakpoint
CREATE INDEX "idx_app_sessions_conversation_status" ON "app_sessions" USING btree ("conversation_id","status");--> statement-breakpoint
CREATE INDEX "idx_intents_conversation_status" ON "intents" USING btree ("conversation_id","status");
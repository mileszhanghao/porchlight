-- No two confirmed bookings of the same amenity may overlap in time.
-- A check in application code ("is the slot free? then insert") can be passed
-- by two simultaneous requests. An exclusion constraint makes the database
-- reject the second one, whatever the timing.
CREATE EXTENSION IF NOT EXISTS btree_gist;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_no_overlap"
  EXCLUDE USING gist ("amenity_id" WITH =, tstzrange("starts_at", "ends_at", '[)') WITH &&)
  WHERE ("status" = 'confirmed');

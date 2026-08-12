-- A photo of the person.
--
-- People cards were falling back to the logo of the brand the person works for,
-- which meant two contacts at the same client were visually identical. A face
-- is the fastest way to find somebody in a list.
--
-- Stored as a URL rather than bytes: these come from a company site or a
-- profile page, and putting image blobs in Postgres to render a 34px circle
-- would be a lot of machinery for no gain.
alter table people add column if not exists avatar_url text;

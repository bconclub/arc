-- ARC Feed Sources — 20 verified working RSS feeds (June 2026)
-- Run in Supabase dashboard → SQL Editor
-- Safe to re-run: ON CONFLICT(value) updates name and sets active=true

INSERT INTO sources (name, type, value, active, added_at) VALUES

  -- India startup ecosystem
  ('Inc42',                       'rss', 'https://inc42.com/feed/',                                              true, now()),
  ('YourStory',                   'rss', 'https://yourstory.com/feed',                                          true, now()),

  -- Marketing & content
  ('HubSpot Marketing',           'rss', 'https://blog.hubspot.com/marketing/rss.xml',                          true, now()),
  ('Neil Patel Blog',             'rss', 'https://neilpatel.com/feed/',                                         true, now()),
  ('Buffer Blog',                 'rss', 'https://buffer.com/resources/rss/',                                   true, now()),
  ('Sprout Social Insights',      'rss', 'https://sproutsocial.com/insights/feed/',                             true, now()),
  ('MarTech Series',              'rss', 'https://martechseries.com/feed/',                                     true, now()),
  ('Social Media Examiner',       'rss', 'http://www.socialmediaexaminer.com/feed/',                            true, now()),

  -- SEO
  ('Ahrefs Blog',                 'rss', 'https://ahrefs.com/blog/feed/',                                       true, now()),
  ('Moz Blog',                    'rss', 'http://feeds.feedburner.com/seomoz',                                  true, now()),
  ('Search Engine Journal',       'rss', 'https://www.searchenginejournal.com/feed/',                           true, now()),

  -- AI & tech news
  ('VentureBeat AI',              'rss', 'https://venturebeat.com/category/ai/feed/',                          true, now()),
  ('MIT Technology Review',       'rss', 'https://www.technologyreview.com/feed/',                              true, now()),
  ('TechCrunch',                  'rss', 'https://feeds.feedburner.com/Techcrunch',                             true, now()),
  ('Ben''s Bites AI',             'rss', 'https://www.bensbites.com/feed',                                     true, now()),

  -- Creator economy & media
  ('Fast Company Creator Economy','rss', 'https://www.fastcompany.com/section/the-creator-economy/rss',        true, now()),
  ('ICYMI — Lia Haberman',        'rss', 'https://liahaberman.substack.com/feed',                              true, now()),
  ('Simon Owens Media',           'rss', 'https://simonowens.substack.com/feed',                               true, now()),
  ('Next in Media',               'rss', 'https://mikeshields.substack.com/feed',                              true, now()),

  -- B2B SaaS & growth
  ('SaaStr',                      'rss', 'https://www.saastr.com/feed/',                                       true, now())

ON CONFLICT (value) DO UPDATE
  SET name   = EXCLUDED.name,
      active = true;

-- Create saved_signals table for persisting interesting signals
CREATE TABLE IF NOT EXISTS saved_signals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  source TEXT NOT NULL,
  source_type TEXT CHECK (source_type IN ('rss', 'search')),
  published_at TIMESTAMPTZ,
  score INTEGER DEFAULT 0,
  excerpt TEXT,
  favicon_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, url)
);

-- Enable RLS
ALTER TABLE saved_signals ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own saved signals
CREATE POLICY "Users can view own saved signals"
  ON saved_signals
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own saved signals"
  ON saved_signals
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own saved signals"
  ON saved_signals
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own saved signals"
  ON saved_signals
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Index for faster lookups
CREATE INDEX idx_saved_signals_user_id ON saved_signals(user_id);
CREATE INDEX idx_saved_signals_url ON saved_signals(url);
CREATE INDEX idx_saved_signals_created_at ON saved_signals(created_at DESC);

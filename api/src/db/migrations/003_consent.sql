-- Date à laquelle l'utilisateur a accepté les conditions et confirmé avoir 15 ans ou plus.
ALTER TABLE users ADD COLUMN terms_accepted_at timestamptz;

-- Classeurs : pages de cartes rangées comme dans un vrai classeur.
-- Le contenu (nom, couleur, format, cases) est gardé tel quel en JSON.
CREATE TABLE binders (
  id          uuid PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  data        jsonb NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX binders_user_idx ON binders (user_id);

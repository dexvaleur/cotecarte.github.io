-- Schéma initial de la base de données Poké Card.
-- Chaque table est expliquée ; les « -- » sont des commentaires SQL.

-- Les utilisateurs (connexion par email, sans mot de passe).
CREATE TABLE users (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text NOT NULL UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Codes à 6 chiffres envoyés par email. On ne garde que leur « empreinte » (hash), jamais le code.
CREATE TABLE login_codes (
  id          serial PRIMARY KEY,
  email       text NOT NULL,
  code_hash   text NOT NULL,
  attempts    integer NOT NULL DEFAULT 0,
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX login_codes_email_idx ON login_codes (email, created_at DESC);

-- Sessions : un jeton par appareil connecté (on garde aussi seulement son empreinte).
CREATE TABLE sessions (
  token_hash   text PRIMARY KEY,
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL
);
CREATE INDEX sessions_user_idx ON sessions (user_id);

-- Les cartes de la collection. « uid » est créé par l'appli : ajouter deux fois
-- le même exemplaire (ex. après une coupure réseau) ne crée pas de doublon.
CREATE TABLE collection_items (
  uid             uuid PRIMARY KEY,
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_id         text NOT NULL,
  name            text NOT NULL,
  image           text,
  set_id          text NOT NULL,
  set_name        text NOT NULL,
  local_id        text NOT NULL,
  rarity          text,
  types           text[] NOT NULL DEFAULT '{}',
  condition       text NOT NULL DEFAULT 'NM',
  quantity        integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  price_eur       double precision,
  purchase_price  double precision,
  added_at        timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX collection_user_idx ON collection_items (user_id);
CREATE INDEX collection_card_idx ON collection_items (card_id);

-- La wishlist : les cartes que l'utilisateur veut.
CREATE TABLE wishlist (
  user_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_id   text NOT NULL,
  name      text NOT NULL,
  image     text,
  set_name  text NOT NULL,
  added_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, card_id)
);

-- Cache des réponses de TCGdex : on évite de redemander la même chose sans arrêt.
CREATE TABLE api_cache (
  key         text PRIMARY KEY,
  body        jsonb NOT NULL,
  fetched_at  timestamptz NOT NULL DEFAULT now()
);

-- Une photo des prix par carte et par jour : c'est ce qui permet de tracer les courbes.
CREATE TABLE price_snapshots (
  card_id     text NOT NULL,
  day         date NOT NULL,
  trend       double precision,
  avg         double precision,
  low         double precision,
  avg30       double precision,
  tcg_market  double precision,
  PRIMARY KEY (card_id, day)
);

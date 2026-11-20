-- Onglet Vendre : annonces entre membres, photos, discussions et signalements.

-- Une annonce : une ou plusieurs cartes à vendre ou à échanger.
CREATE TABLE listings (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title        text NOT NULL,
  description  text NOT NULL DEFAULT '',
  hashtags     text[] NOT NULL DEFAULT '{}',
  kind         text NOT NULL DEFAULT 'vente',      -- vente, echange, les2
  price_eur    double precision,                    -- vide = prix à discuter
  condition    text,                                -- NM, EX…
  card_id      text,                                -- carte liée (facultatif)
  status       text NOT NULL DEFAULT 'active',      -- active, reservee, vendue
  photo_count  integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX listings_recent_idx ON listings (created_at DESC);
CREATE INDEX listings_user_idx ON listings (user_id);

-- Les photos des annonces (JPEG réduit sur le téléphone avant l'envoi).
CREATE TABLE listing_photos (
  listing_id  uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  pos         integer NOT NULL,
  data        bytea NOT NULL,
  PRIMARY KEY (listing_id, pos)
);

-- Une discussion = une annonce + un acheteur intéressé (le vendeur est celui de l'annonce).
CREATE TABLE conversations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id      uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  buyer_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seller_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  buyer_read_at   timestamptz NOT NULL DEFAULT now(),
  seller_read_at  timestamptz NOT NULL DEFAULT now(),
  last_at         timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (listing_id, buyer_id)
);
CREATE INDEX conversations_buyer_idx ON conversations (buyer_id, last_at DESC);
CREATE INDEX conversations_seller_idx ON conversations (seller_id, last_at DESC);

CREATE TABLE messages (
  id               bigserial PRIMARY KEY,
  conversation_id  uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body             text NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX messages_conv_idx ON messages (conversation_id, id);

-- Membres bloqués : plus aucun message entre les deux.
CREATE TABLE blocks (
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, blocked_id)
);

-- Signalements (annonce ou membre), lus par l'administrateur.
CREATE TABLE reports (
  id           serial PRIMARY KEY,
  reporter_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_id   uuid REFERENCES listings(id) ON DELETE CASCADE,
  target_id    uuid REFERENCES users(id) ON DELETE CASCADE,
  reason       text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

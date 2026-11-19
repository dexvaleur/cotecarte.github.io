-- Statistiques des extensions récentes (onglet Packs), recalculées une fois par jour.
CREATE TABLE pack_stats (
  set_id      text PRIMARY KEY,
  data        jsonb NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Statistiques de visite anonymes : seulement des compteurs par jour.
-- Aucune adresse IP, aucun identifiant : impossible de savoir qui a visité.
CREATE TABLE stats_daily (
  day     date NOT NULL,
  metric  text NOT NULL,
  count   integer NOT NULL DEFAULT 0,
  PRIMARY KEY (day, metric)
);

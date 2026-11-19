-- Profil : pseudo et avatar (réglages du dessin), gardés en JSON.
ALTER TABLE users ADD COLUMN profile jsonb;

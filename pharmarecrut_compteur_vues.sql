-- =====================================================================
-- PharmaRecrut — Compteur de vues des offres (OPTIONNEL)
-- Projet Supabase : ucrcuwijoktseptguria
-- À exécuter dans : Supabase → SQL Editor → New query → Run
--
-- ⚠️ Ce script n'est PLUS nécessaire au fonctionnement du site :
--    le dépôt d'offres et « Mes annonces » marchent désormais SANS SQL.
--    Il sert UNIQUEMENT à rendre le compteur de vues persistant et
--    partagé (visible par l'officine). Sans lui, le site fonctionne,
--    les vues ne sont simplement pas comptabilisées durablement.
--
-- Script IDEMPOTENT : peut être relancé sans risque.
-- =====================================================================

-- 1) Colonne compteur de vues (entier, défaut 0).
alter table public.offers
  add column if not exists views integer not null default 0;

-- 2) Incrément atomique des vues (contourne RLS de façon contrôlée :
--    n'incrémente qu'un entier sur une offre EN LIGNE).
create or replace function public.increment_offer_views(offer_id text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.offers
     set views = coalesce(views, 0) + 1
   where id::text = offer_id
     and status = 'approved';
$$;

-- 3) Autoriser l'appel depuis le site.
grant execute on function public.increment_offer_views(text) to anon, authenticated;

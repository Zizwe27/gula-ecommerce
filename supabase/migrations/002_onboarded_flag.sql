-- Migration 002 — Add onboarded flag to profiles
-- Tracks whether a user has completed the initial onboarding screen.

alter table profiles
  add column onboarded boolean not null default false;

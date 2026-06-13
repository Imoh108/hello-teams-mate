## Goal

Fully reset the database by removing the remaining real user (imohi2013@gmail.com) and all data tied to any user, leaving an empty app ready for fresh signups.

## What gets deleted

All rows from:
- auth.users (the last remaining account)
- profiles, user_roles
- organizations, organization_members, organization_invites, departments
- quizzes, questions, question_banks, bank_questions, bank_tags
- sessions, session_players, answers
- point_events, challenges, challenge_participants
- user_badges, user_avatar_items
- training_documents, content_sources
- ai_generated_items, ai_generation_jobs
- analytics_events
- platform_settings (optional — clears any saved super-admin config)

Reference tables left intact: badges, avatar_items (catalog data, not user-owned).

## Effect

- Next person to sign up becomes the first user and is auto-granted `platform_admin` via the `handle_new_user` trigger, regaining access to `/platform`.
- All quizzes, sessions, and storage references are gone.

## Note

Files in the `training-documents` storage bucket are not auto-deleted by the SQL wipe. I'll list and delete them as a second step if you want a fully clean slate.

## Confirmation needed

This is destructive and irreversible. Confirm before I switch to build and run it.

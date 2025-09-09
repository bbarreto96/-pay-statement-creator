# Data Layer

This folder provides a backend-agnostic data client used by the UI. It defaults to a local adapter backed by existing in-app data and can be switched to Supabase by setting:

- NEXT_PUBLIC_DATA_BACKEND=supabase
- NEXT_PUBLIC_SUPABASE_URL=...
- NEXT_PUBLIC_SUPABASE_ANON_KEY=...

Adapters:
- LocalDataClient: reads from src/data/contractorDatabase
- SupabaseDataClient: reads from Supabase (requires DB schema and an app_contractors view or matching table)


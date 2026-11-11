// Inställningar för synken. Fyll i de två värdena nedan när SQL-filen är körd (se docs/research/synk.md).
//
// url: projektets adress. Finns i Supabase under Project Settings, Data API, "Project URL".
// key: den PUBLICERBARA nyckeln (börjar med sb_publishable_). Finns under Project Settings, API Keys.
//      Den är gjord för att ligga i webbsidor. Skyddet sitter i inloggningen och i radreglerna (RLS).
//
// Lägg ALDRIG in en hemlig nyckel här (sb_secret_... eller service_role), och inget lösenord.
// Så länge platshållarna står kvar är synken avstängd och spelet sparar bara på enheten.
export const SYNC_CONFIG = {
  url: 'https://bhurxoknmyfqymtiaycx.supabase.co',
  key: 'sb_publishable_eVv0YIKYjdwRKQFK_DORCA_QhE4qgiB',
};

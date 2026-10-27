-- READ ONLY. Schema/migration metadata only: no user rows or email addresses.
begin read only;
select c.relname as index_name, i.indisunique, i.indisvalid,
       pg_get_indexdef(i.indexrelid) as definition
from pg_index i
join pg_class c on c.oid = i.indexrelid
where i.indrelid = 'auth.users'::regclass
  and c.relname in ('users_email_partial_key', 'users_email_key');
select version, name from supabase_migrations.schema_migrations
where version in ('20261027000000','20261027010000','20261027020000','20261027030000')
order by version;
rollback;

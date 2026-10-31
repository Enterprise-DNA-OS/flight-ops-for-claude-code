-- Flight Ops for Claude Code: bases, aircraft, crew and type ratings, clients,
-- quotes, trips, legs (the journey log), passenger manifests, crew duty periods,
-- defects and the operator's flight and duty limits. Plain Postgres; runs on
-- PGlite unchanged. Every time is UTC, as a journey log is.

create function touch_updated() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- The operator's flight and duty scheme and currency settings. The seed holds
-- demo values only: set each one from your approved scheme (see docs/compliance.md).
create table limits (
  key text primary key,
  value numeric not null check (value > 0),
  unit text not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table bases (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  country text not null check (country in ('NZ','AU')),
  certificate_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One row per airframe. hours_base is the airframe total as at hours_base_at;
-- flying logged after that date is added to it in v_fleet.
create table aircraft (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  type text not null,
  kind text not null default 'helicopter' check (kind in ('helicopter','aeroplane')),
  base_id uuid references bases,
  seats integer not null check (seats between 1 and 50),
  payload_kg integer check (payload_kg > 0),
  hourly_rate numeric(10,2) check (hourly_rate >= 0),
  hours_base numeric(10,1) not null default 0 check (hours_base >= 0),
  hours_base_at timestamptz not null default now(),
  next_check_hours numeric(10,1),
  next_check_name text,
  arc_expiry date,
  status text not null default 'serviceable' check (status in ('serviceable','unserviceable','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table crew (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  role text not null default 'pilot' check (role in ('pilot','crew')),
  base_id uuid references bases,
  licence_ref text,
  weight_kg integer check (weight_kg between 30 and 200),
  medical_class integer check (medical_class in (1,2)),
  medical_expiry date,
  flight_review_on date,
  competency_on date,
  email text,
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Which aircraft types each pilot is rated and checked to fly.
create table ratings (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references crew,
  aircraft_type text not null,
  rated_on date,
  unique (crew_id, aircraft_type),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table clients (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  email text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table quotes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  client_id uuid not null references clients,
  aircraft_id uuid not null references aircraft,
  flight_date date not null,
  route text not null,
  pax integer not null default 0 check (pax >= 0),
  est_hours numeric(6,1) not null check (est_hours > 0),
  rate numeric(10,2) not null check (rate >= 0),
  extras numeric(10,2) not null default 0 check (extras >= 0),
  price numeric(12,2) generated always as (round(est_hours * rate + extras, 2)) stored,
  sent_on date,
  valid_until date,
  status text not null default 'draft' check (status in ('draft','sent','accepted','declined','expired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table trips (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  client_id uuid references clients,
  quote_id uuid references quotes,
  aircraft_id uuid not null references aircraft,
  pic_id uuid references crew,
  flight_date date not null,
  purpose text not null default 'charter' check (purpose in ('charter','scenic','positioning','training','survey','other')),
  status text not null default 'planned' check (status in ('planned','confirmed','flown','cancelled')),
  invoice_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One row per sector. Scheduled times are the plan; block and air times are the
-- journey log, filled in after the flight.
create table legs (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips,
  seq integer not null check (seq > 0),
  dep text not null,
  arr text not null,
  std timestamptz,
  pax integer not null default 0 check (pax >= 0),
  block_off timestamptz,
  takeoff timestamptz,
  landing timestamptz,
  block_on timestamptz,
  landings integer not null default 1 check (landings >= 0),
  fuel_l numeric(8,1) check (fuel_l >= 0),
  unique (trip_id, seq),
  check (block_on is null or block_off is null or block_on > block_off),
  check (landing is null or takeoff is null or landing > takeoff),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table passengers (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips,
  name text not null check (length(trim(name)) > 0),
  weight_kg integer not null check (weight_kg between 1 and 250),
  bags_kg integer not null default 0 check (bags_kg >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table duties (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references crew,
  start_at timestamptz not null,
  end_at timestamptz not null,
  kind text not null default 'flying' check (kind in ('flying','standby','ground','training')),
  note text,
  check (end_at > start_at),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table defects (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  aircraft_id uuid not null references aircraft,
  raised_on date not null,
  description text not null check (length(trim(description)) > 0),
  deferred boolean not null default false,
  due_on date,
  cleared_on date,
  cleared_ref text,
  check (not deferred or due_on is not null),
  check (cleared_on is null or cleared_ref is not null),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table notes (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips,
  body text not null check (length(trim(body)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$ declare t text; begin
  foreach t in array array['limits','bases','aircraft','crew','ratings','clients','quotes','trips','legs','passengers','duties','defects','notes'] loop
    execute format('create trigger touch before update on %I for each row execute function touch_updated()', t);
  end loop;
end $$;

-- A journey log entry, once the aircraft is back on blocks, is a record: times
-- and landings stay as written. Corrections go in a note on the trip.
create function lock_leg() returns trigger language plpgsql as $$
begin
  if old.block_on is not null and (new.block_off is distinct from old.block_off or new.block_on is distinct from old.block_on
     or new.takeoff is distinct from old.takeoff or new.landing is distinct from old.landing or new.landings <> old.landings
     or new.dep <> old.dep or new.arr <> old.arr) then
    raise exception 'Leg % of the trip is logged: journey log times stay as written. Add a correction note to the trip.', old.seq;
  end if;
  return new;
end $$;
create trigger leg_locked before update on legs for each row execute function lock_leg();
create function no_delete() returns trigger language plpgsql as $$
begin raise exception '% records are kept: mark them instead of deleting', tg_table_name; end $$;
create trigger legs_kept before delete on legs for each row when (old.block_on is not null) execute function no_delete();
create trigger duties_kept before delete on duties for each row execute function no_delete();
create trigger defects_kept before delete on defects for each row execute function no_delete();

create function lim(k text) returns numeric language sql stable as $$ select value from limits where key = k $$;

-- Every leg with its block and air time in hours. Air time falls back to block time.
create view v_legs as
select l.id leg_id, t.code trip, l.seq, t.flight_date, a.code aircraft, a.type aircraft_type, c.code pic, c.id pic_id,
       l.dep, l.arr, to_char(l.std at time zone 'UTC','HH24:MI') std, l.pax,
       to_char(l.block_off at time zone 'UTC','HH24:MI') off_utc, to_char(l.block_on at time zone 'UTC','HH24:MI') on_utc,
       round((extract(epoch from (l.block_on - l.block_off))/3600)::numeric, 2) block_hours,
       round((extract(epoch from coalesce(l.landing - l.takeoff, l.block_on - l.block_off))/3600)::numeric, 2) air_hours,
       l.landings, l.fuel_l, l.block_on is not null logged, coalesce(l.takeoff, l.block_off) airborne_at, t.status trip_status
from legs l
join trips t on t.id = l.trip_id
join aircraft a on a.id = t.aircraft_id
left join crew c on c.id = t.pic_id;

-- Each trip with its legs, passengers, payload and charge.
create view v_trips as
select t.id trip_id, t.code, t.flight_date, t.status, t.purpose, cl.name client, a.code aircraft, a.type aircraft_type,
       a.status aircraft_status, c.code pic, c.name pic_name, q.code quote,
       count(l.id)::int legs, count(l.id) filter (where l.block_on is not null)::int logged_legs,
       coalesce(max(l.pax),0) pax, m.manifest,
       coalesce(sum(round((extract(epoch from coalesce(l.landing - l.takeoff, l.block_on - l.block_off))/3600)::numeric, 2)),0) air_hours,
       c.weight_kg + m.load_kg payload_kg, a.payload_kg max_payload_kg,
       case when q.id is not null then q.price
            else round(coalesce(sum(round((extract(epoch from coalesce(l.landing - l.takeoff, l.block_on - l.block_off))/3600)::numeric, 2)),0) * coalesce(a.hourly_rate,0), 2) end charge,
       t.invoice_ref, string_agg(l.dep || '-' || l.arr, ' ' order by l.seq) route
from trips t
join aircraft a on a.id = t.aircraft_id
left join clients cl on cl.id = t.client_id
left join crew c on c.id = t.pic_id
left join quotes q on q.id = t.quote_id
left join legs l on l.trip_id = t.id
cross join lateral (select count(*)::int manifest, coalesce(sum(weight_kg + bags_kg),0)::int load_kg from passengers p where p.trip_id = t.id) m
group by t.id, cl.id, a.id, c.id, q.id, m.manifest, m.load_kg;

-- Airframe hours, hours to the next check, airworthiness review and open defects.
create view v_fleet as
select a.id aircraft_id, a.code, a.type, a.kind, b.code base, a.status, a.seats,
       round(a.hours_base + coalesce((select sum(air_hours) from v_legs v where v.aircraft = a.code and v.logged and v.airborne_at >= a.hours_base_at),0), 1) hours,
       a.next_check_name, a.next_check_hours,
       round(a.next_check_hours - (a.hours_base + coalesce((select sum(air_hours) from v_legs v where v.aircraft = a.code and v.logged and v.airborne_at >= a.hours_base_at),0)), 1) hours_to_check,
       a.arc_expiry, a.arc_expiry - current_date days_to_arc,
       (select count(*) from defects d where d.aircraft_id = a.id and d.cleared_on is null)::int open_defects,
       (select count(*) from defects d where d.aircraft_id = a.id and d.cleared_on is null and d.deferred)::int deferred_defects
from aircraft a left join bases b on b.id = a.base_id;

-- Duty periods with their length and the rest taken before each one.
create view v_duties as
select d.id duty_id, c.code crew, c.name, d.kind, d.start_at, d.end_at,
       to_char(d.start_at at time zone 'UTC','YYYY-MM-DD HH24:MI') starts, to_char(d.end_at at time zone 'UTC','YYYY-MM-DD HH24:MI') ends,
       round((extract(epoch from (d.end_at - d.start_at))/3600)::numeric, 1) duty_hours,
       round((extract(epoch from (d.start_at - lag(d.end_at) over (partition by d.crew_id order by d.start_at)))/3600)::numeric, 1) rest_before_hours
from duties d join crew c on c.id = d.crew_id;

-- Flight and duty hours against the scheme, per crew member.
create view v_crew_hours as
select c.code crew, c.name,
       coalesce((select sum(air_hours) from v_legs v where v.pic_id = c.id and v.logged and v.airborne_at >= now() - interval '7 days'),0) flight_7d, lim('flight_hours_7d') limit_7d,
       coalesce((select sum(air_hours) from v_legs v where v.pic_id = c.id and v.logged and v.airborne_at >= now() - interval '28 days'),0) flight_28d, lim('flight_hours_28d') limit_28d,
       coalesce((select sum(air_hours) from v_legs v where v.pic_id = c.id and v.logged and v.airborne_at >= now() - interval '365 days'),0) flight_365d, lim('flight_hours_365d') limit_365d,
       coalesce((select sum(duty_hours) from v_duties v where v.crew = c.code and v.start_at >= now() - interval '7 days'),0) duty_7d, lim('duty_hours_7d') duty_limit_7d
from crew c where c.active and c.role = 'pilot';

-- Medical, flight review, operator check and passenger recency for each pilot.
create view v_currency as
select c.id crew_id, c.code crew, c.name, c.medical_class, c.medical_expiry, c.medical_expiry - current_date medical_days,
       (c.flight_review_on + make_interval(months => lim('flight_review_months')::int))::date review_due,
       (c.competency_on + make_interval(months => lim('competency_months')::int))::date check_due,
       coalesce((select sum(landings) from v_legs v where v.pic_id = c.id and v.logged and v.airborne_at >= now() - make_interval(days => lim('recency_days')::int)),0)::int landings_90d,
       coalesce((select sum(landings) from v_legs v where v.pic_id = c.id and v.logged and v.airborne_at >= now() - make_interval(days => lim('recency_days')::int)),0) >= lim('recency_landings') pax_current,
       (select string_agg(aircraft_type, ', ' order by aircraft_type) from ratings r where r.crew_id = c.id) types
from crew c where c.active and c.role = 'pilot';

-- What tomorrow and the days after hold, with every reason a trip should not go as planned.
create view v_schedule as
select t.code, t.flight_date, t.status, t.purpose, t.client, t.aircraft, t.aircraft_type, t.pic, t.route, t.pax, t.manifest,
       (select to_char(min(std) at time zone 'UTC','HH24:MI') from legs l where l.trip_id = t.trip_id) first_std,
       concat_ws('; ',
         case when t.pic is null then 'no pilot' end,
         case when t.aircraft_status <> 'serviceable' then 'aircraft ' || t.aircraft_status end,
         case when f.days_to_arc < 0 then 'airworthiness review expired' end,
         case when f.hours_to_check < 0 then 'maintenance check overdue' end,
         case when t.pic is not null and cu.medical_expiry < t.flight_date then 'pilot medical expired' end,
         case when t.pic is not null and cu.review_due < t.flight_date then 'flight review overdue' end,
         case when t.pic is not null and cu.check_due < t.flight_date then 'operator check overdue' end,
         case when t.pic is not null and t.pax > 0 and not cu.pax_current then 'pilot not current for passengers' end,
         case when t.pic is not null and not exists (select 1 from ratings r where r.crew_id = cu.crew_id and lower(r.aircraft_type) = lower(t.aircraft_type)) then 'pilot not rated on ' || t.aircraft_type end,
         case when t.pax > 0 and t.manifest < t.pax then 'manifest ' || t.manifest || ' of ' || t.pax end,
         case when t.payload_kg > t.max_payload_kg then 'payload ' || t.payload_kg || ' kg over ' || t.max_payload_kg end) problems
from v_trips t
join v_fleet f on f.code = t.aircraft
left join v_currency cu on cu.crew = t.pic
where t.status in ('planned','confirmed') and t.flight_date >= current_date;

create view v_compliance as
select 'FTL-DUTY-LENGTH' rule, crew || ' ' || starts record, duty_hours || ' hour duty, scheme limit ' || lim('max_duty_hours') issue
from v_duties where duty_hours > lim('max_duty_hours') and start_at >= now() - interval '90 days'
union all
select 'FTL-REST', crew || ' ' || starts, rest_before_hours || ' hours rest before this duty, scheme minimum ' || lim('min_rest_hours')
from v_duties where rest_before_hours < lim('min_rest_hours') and start_at >= now() - interval '90 days'
union all
select 'FTL-FLIGHT-HOURS', crew, concat_ws('; ',
         case when flight_7d > limit_7d then flight_7d || ' flight hours in 7 days, limit ' || limit_7d end,
         case when flight_28d > limit_28d then flight_28d || ' flight hours in 28 days, limit ' || limit_28d end,
         case when flight_365d > limit_365d then flight_365d || ' flight hours in 365 days, limit ' || limit_365d end,
         case when duty_7d > duty_limit_7d then duty_7d || ' duty hours in 7 days, limit ' || duty_limit_7d end)
from v_crew_hours where flight_7d > limit_7d or flight_28d > limit_28d or flight_365d > limit_365d or duty_7d > duty_limit_7d
union all
select 'MEDICAL', crew, case when medical_expiry is null then 'No medical certificate expiry recorded' else 'Class ' || medical_class || ' medical expired ' || medical_expiry end
from v_currency where medical_expiry is null or medical_expiry < current_date
union all
select 'FLIGHT-REVIEW', crew, case when review_due is null then 'No flight review date recorded' else 'Flight review was due ' || review_due end
from v_currency where review_due is null or review_due < current_date
union all
select 'OPERATOR-CHECK', crew, case when check_due is null then 'No operator competency check recorded' else 'Operator competency check was due ' || check_due end
from v_currency where check_due is null or check_due < current_date
union all
select 'PAX-RECENCY', s.code, s.pic || ' has ' || cu.landings_90d || ' landings in ' || lim('recency_days') || ' days, needs ' || lim('recency_landings') || ' to carry passengers'
from v_schedule s join v_currency cu on cu.crew = s.pic where s.pax > 0 and not cu.pax_current
union all
select 'TYPE-RATING', s.code, s.pic || ' has no rating recorded on ' || s.aircraft_type
from v_schedule s join v_currency cu on cu.crew = s.pic where not exists (select 1 from ratings r where r.crew_id = cu.crew_id and lower(r.aircraft_type) = lower(s.aircraft_type))
union all
select 'ARC-EXPIRED', code, 'Airworthiness review expired ' || arc_expiry from v_fleet where arc_expiry < current_date and status <> 'inactive'
union all
select 'CHECK-OVERDUE', code, coalesce(next_check_name,'Next check') || ' due at ' || next_check_hours || ' hours, airframe at ' || hours from v_fleet where hours_to_check < 0
union all
select 'DEFERRAL-EXPIRED', d.code, a.code || ': ' || d.description || ', deferred until ' || d.due_on
from defects d join aircraft a on a.id = d.aircraft_id where d.deferred and d.cleared_on is null and d.due_on < current_date
union all
select 'MANIFEST', code, 'Flew ' || pax || ' passengers with ' || manifest || ' on the manifest'
from v_trips where status = 'flown' and pax > manifest
union all
select 'JOURNEY-LOG', code, (legs - logged_legs) || ' of ' || legs || ' legs have no block times'
from v_trips where flight_date < current_date and status in ('confirmed','flown') and logged_legs < legs
union all
select 'PAYLOAD', code, 'Pilot and manifest weigh ' || payload_kg || ' kg, aircraft payload ' || max_payload_kg || ' kg'
from v_trips where status in ('planned','confirmed') and payload_kg > max_payload_kg;

create view v_attention as
select 'trip tomorrow not confirmed' kind, code record, flight_date::text due, coalesce(client,'') || ' ' || route detail
from v_schedule where status = 'planned' and flight_date <= current_date + 1
union all
select 'trip with a problem', code, flight_date::text, problems from v_schedule where problems <> '' and flight_date <= current_date + 7
union all
select 'quote waiting on client', q.code, q.valid_until::text, cl.name || ', ' || q.route
from quotes q join clients cl on cl.id = q.client_id where q.status = 'sent' and q.valid_until <= current_date + 2
union all
select 'past trip not logged', code, flight_date::text, (legs - logged_legs) || ' legs without block times'
from v_trips where flight_date < current_date and status in ('planned','confirmed')
union all
select 'flown trip not invoiced', code, flight_date::text, coalesce(client,'') || ', ' || charge
from v_trips where status = 'flown' and invoice_ref is null and client is not null
union all
select 'medical due', crew, medical_expiry::text, 'Class ' || medical_class || ' medical expires in ' || medical_days || ' days'
from v_currency where medical_days between 0 and 45
union all
select 'check due soon', code, coalesce(next_check_name,'next check'), hours_to_check || ' hours to go'
from v_fleet where hours_to_check between 0 and 10
union all
select 'deferred defect due', d.code, d.due_on::text, a.code || ': ' || d.description
from defects d join aircraft a on a.id = d.aircraft_id where d.deferred and d.cleared_on is null and d.due_on <= current_date + 7;

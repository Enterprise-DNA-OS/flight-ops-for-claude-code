-- Fictional Southern Lakes Air: two New Zealand bases and one in Cairns, four
-- aircraft, five pilots and a fortnight of charter, scenic and survey flying, dated
-- relative to today so there is always something to chase. Every time is UTC.
-- Idempotent: running it twice changes nothing and never resets operational changes.

insert into limits(key,value,unit,note) values
 ('max_duty_hours',11,'hours','Longest single duty period. Demo value: set from your approved scheme.'),
 ('min_rest_hours',10,'hours','Shortest rest before a duty. Demo value: set from your approved scheme.'),
 ('flight_hours_7d',30,'hours','Flight time in any 7 days. Demo value.'),
 ('flight_hours_28d',100,'hours','Flight time in any 28 days. Demo value.'),
 ('flight_hours_365d',1000,'hours','Flight time in any 365 days. Demo value.'),
 ('duty_hours_7d',60,'hours','Duty time in any 7 days. Demo value.'),
 ('flight_review_months',24,'months','Flight review interval.'),
 ('competency_months',12,'months','Operator competency check interval. House setting.'),
 ('recency_days',90,'days','Window for passenger recency.'),
 ('recency_landings',3,'landings','Take-offs and landings needed in the window to carry passengers.')
on conflict (key) do nothing;

insert into bases(code,name,country,certificate_ref) values
 ('ZQN','Queenstown','NZ','DEMO-AOC-0001'),
 ('MFN','Milford Sound','NZ','DEMO-AOC-0001'),
 ('CNS','Cairns','AU','DEMO-AOC-0002')
on conflict (code) do nothing;

insert into aircraft(code,type,kind,base_id,seats,payload_kg,hourly_rate,hours_base,hours_base_at,next_check_hours,next_check_name,arc_expiry,status)
select v.code,v.type,v.kind,b.id,v.seats,v.payload,v.rate,v.hours,(current_date - 30)::timestamp at time zone 'UTC',v.next,v.next_name,current_date + v.arc,v.status
from (values
 ('ZK-HQA','AS350','helicopter','ZQN',6,900,2650,8412.0,8425.0,'100 hourly',150,'serviceable'),
 ('ZK-HQB','B407','helicopter','ZQN',6,850,2900,11840.5,11990.0,'300 hourly',40,'serviceable'),
 ('ZK-PLA','C208','aeroplane','MFN',12,1200,3100,6120.0,6200.0,'100 hourly',-4,'serviceable'),
 ('VH-RXC','R44','helicopter','CNS',3,300,950,2210.0,2300.0,'100 hourly',200,'unserviceable')
) v(code,type,kind,base,seats,payload,rate,hours,next,next_name,arc,status)
join bases b on b.code = v.base
on conflict (code) do nothing;

insert into crew(code,name,base_id,licence_ref,weight_kg,medical_class,medical_expiry,flight_review_on,competency_on,email,phone)
select v.code,v.name,b.id,v.licence,v.weight,1,current_date + v.medical,current_date + v.review,current_date + v.competency,v.email,v.phone
from (values
 ('AN','Aroha Ngata','ZQN','CPL(H) DEMO-1001',68,210,-300,-120,'aroha@southernlakes.example','021 555 0101'),
 ('BC','Ben Clarke','ZQN','CPL(A) DEMO-1002',88,-5,-400,-200,'ben@southernlakes.example','021 555 0102'),
 ('MT','Mia Thompson','MFN','CPL(A) DEMO-1003',62,30,-800,-60,'mia@southernlakes.example','021 555 0103'),
 ('JW','Jack Wilson','CNS','CPL(H) DEMO-2001',80,300,-100,-400,'jack@southernlakes.example','0400 555 201'),
 ('ST','Sophie Tane','ZQN','CPL(H) DEMO-1004',70,150,-200,-30,'sophie@southernlakes.example','021 555 0104')
) v(code,name,base,licence,weight,medical,review,competency,email,phone)
join bases b on b.code = v.base
on conflict (code) do nothing;

insert into ratings(crew_id,aircraft_type)
select c.id,v.type from (values ('AN','AS350'),('AN','B407'),('BC','AS350'),('BC','C208'),('MT','B407'),('MT','C208'),
 ('JW','R44'),('ST','AS350'),('ST','B407'),('ST','C208')) v(crew,type)
join crew c on c.code = v.crew
on conflict (crew_id,aircraft_type) do nothing;

insert into clients(code,name,email,phone) values
 ('SKYLINE','Skyline Scenic Tours','bookings@skyline-scenic.example','03 400 1000'),
 ('LAKESIDE','Lakeside Lodge','concierge@lakeside-lodge.example','03 400 2000'),
 ('ALPINE','Alpine Survey Ltd','ops@alpine-survey.example','03 400 3000'),
 ('FILM','Southern Film Services','unit@southern-film.example','03 400 4000'),
 ('REEF','Reef Charters Cairns','hello@reef-charters.example','07 4000 5000')
on conflict (code) do nothing;

insert into quotes(code,client_id,aircraft_id,flight_date,route,pax,est_hours,rate,extras,sent_on,valid_until,status)
select v.code,cl.id,a.id,current_date + v.d,v.route,v.pax,v.hours,v.rate,v.extras,
       case when v.sent is null then null else current_date + v.sent end, case when v.valid is null then null else current_date + v.valid end, v.status
from (values
 ('Q101','LAKESIDE','ZK-HQA',1,'Lodge to Milford Sound and back',4,1.8,2650,300,-5,10,'accepted'),
 ('Q102','FILM','ZK-HQB',12,'Film unit on The Remarkables, four hours on call',3,4.0,2900,600,-6,-1,'sent'),
 ('Q103','ALPINE','ZK-PLA',20,'Fiordland survey run',2,3.5,3100,0,null,null,'draft'),
 ('Q104','SKYLINE','ZK-HQA',-15,'Two glacier landings',5,1.2,2650,0,-25,-18,'declined'),
 ('Q105','REEF','VH-RXC',8,'Reef scenic, four 30 minute flights',2,2.0,950,0,-1,1,'sent')
) v(code,client,aircraft,d,route,pax,hours,rate,extras,sent,valid,status)
join clients cl on cl.code = v.client join aircraft a on a.code = v.aircraft
on conflict (code) do nothing;

insert into trips(code,client_id,quote_id,aircraft_id,pic_id,flight_date,purpose,status,invoice_ref)
select v.code,cl.id,q.id,a.id,c.id,current_date + v.d,v.purpose,v.status,v.invoice
from (values
 ('T089',null,null,'ZK-PLA','BC',-25,'positioning','flown',null),
 ('T090','SKYLINE',null,'ZK-HQA','AN',-20,'scenic','flown','INV-5101'),
 ('T091','FILM',null,'ZK-HQB','ST',-10,'charter','flown','INV-5102'),
 ('T092','LAKESIDE',null,'ZK-HQA','ST',-6,'charter','flown','INV-5103'),
 ('T093','ALPINE',null,'ZK-PLA','ST',-5,'survey','flown',null),
 ('T094','SKYLINE',null,'ZK-HQA','AN',-2,'scenic','flown',null),
 ('T095','LAKESIDE',null,'ZK-HQB','AN',-1,'charter','flown',null),
 ('T096','SKYLINE',null,'ZK-HQA','AN',-2,'scenic','confirmed',null),
 ('T097','REEF',null,'VH-RXC','JW',-40,'scenic','flown','INV-5090'),
 ('T098','ALPINE',null,'ZK-PLA','MT',-60,'survey','flown','INV-5095'),
 ('T101','LAKESIDE','Q101','ZK-HQA','BC',1,'charter','confirmed',null),
 ('T102','FILM',null,'ZK-HQB','ST',1,'charter','planned',null),
 ('T103','ALPINE',null,'ZK-PLA',null,1,'survey','planned',null),
 ('T104','REEF',null,'VH-RXC','JW',3,'scenic','confirmed',null),
 ('T105','SKYLINE',null,'ZK-HQA','MT',5,'scenic','confirmed',null),
 ('T106',null,null,'ZK-HQA','AN',9,'positioning','confirmed',null)
) v(code,client,quote,aircraft,pic,d,purpose,status,invoice)
left join clients cl on cl.code = v.client
left join quotes q on q.code = v.quote
join aircraft a on a.code = v.aircraft
left join crew c on c.code = v.pic
on conflict (code) do nothing;

-- Legs: scheduled time, then block off, take-off, landing and block on (null until flown).
insert into legs(trip_id,seq,dep,arr,std,pax,block_off,takeoff,landing,block_on,landings,fuel_l)
select t.id,v.seq,v.dep,v.arr,
       (t.flight_date + v.std::time) at time zone 'UTC', v.pax,
       (t.flight_date + v.off_::time) at time zone 'UTC', (t.flight_date + v.to_::time) at time zone 'UTC',
       (t.flight_date + v.ld::time) at time zone 'UTC', (t.flight_date + v.on_::time) at time zone 'UTC',
       v.landings, v.fuel
from (values
 ('T089',1,'ZQN','MFN','09:00',0,'09:00','09:05','09:40','09:45',1,180.0),
 ('T089',2,'MFN','ZQN','11:00',0,'11:00','11:05','11:42','11:46',1,null),
 ('T089',3,'ZQN','ZQN','12:30',0,'12:30','12:33','13:10','13:13',3,null),
 ('T090',1,'ZQN','GLA','09:00',5,'09:00','09:04','09:40','09:42',1,220.0),
 ('T090',2,'GLA','ZQN','10:10',5,'10:10','10:12','10:48','10:51',1,null),
 ('T091',1,'ZQN','REM','06:00',3,'06:00','06:04','06:24','06:26',1,240.0),
 ('T091',2,'REM','ZQN','16:00',3,'16:00','16:03','16:25','16:28',1,null),
 ('T092',1,'ZQN','MFN','07:00',4,'07:00','07:04','07:49','07:52',1,250.0),
 ('T092',2,'MFN','ZQN','15:00',4,'15:00','15:04','15:50','15:53',1,null),
 ('T093',1,'MFN','MFN','02:00',2,'02:00','02:07','05:07','05:12',1,600.0),
 ('T094',1,'ZQN','GLA','08:00',5,'08:00','08:03','08:38','08:40',1,220.0),
 ('T094',2,'GLA','ZQN','09:10',5,'09:10','09:12','09:47','09:50',1,null),
 ('T094',3,'ZQN','GLA','11:00',5,'11:00','11:03','11:38','11:40',1,200.0),
 ('T094',4,'GLA','ZQN','12:10',5,'12:10','12:12','12:47','12:50',1,null),
 ('T095',1,'ZQN','LODGE','08:00',4,'08:00','08:03','08:21','08:23',1,150.0),
 ('T095',2,'LODGE','ZQN','13:00',4,'13:00','13:03','13:20','13:22',1,null),
 ('T096',1,'ZQN','GLA','14:00',5,null,null,null,null,1,null),
 ('T096',2,'GLA','ZQN','15:10',5,null,null,null,null,1,null),
 ('T097',1,'CNS','REEF','09:00',2,'09:00','09:03','09:33','09:35',1,90.0),
 ('T097',2,'REEF','CNS','11:00',2,'11:00','11:02','11:31','11:33',1,null),
 ('T098',1,'MFN','MFN','08:00',2,'08:00','08:06','10:36','10:40',1,500.0),
 ('T101',1,'LODGE','MFN','08:30',4,null,null,null,null,1,null),
 ('T101',2,'MFN','LODGE','12:00',4,null,null,null,null,1,null),
 ('T102',1,'ZQN','REM','07:00',3,null,null,null,null,1,null),
 ('T102',2,'REM','ZQN','15:00',3,null,null,null,null,1,null),
 ('T103',1,'MFN','MFN','09:00',2,null,null,null,null,1,null),
 ('T104',1,'CNS','REEF','09:00',2,null,null,null,null,1,null),
 ('T104',2,'REEF','CNS','10:30',2,null,null,null,null,1,null),
 ('T105',1,'ZQN','GLA','09:00',5,null,null,null,null,1,null),
 ('T105',2,'GLA','ZQN','10:10',5,null,null,null,null,1,null),
 ('T106',1,'ZQN','MFN','08:00',0,null,null,null,null,1,null)
) v(trip,seq,dep,arr,std,pax,off_,to_,ld,on_,landings,fuel)
join trips t on t.code = v.trip
on conflict (trip_id,seq) do nothing;

insert into passengers(trip_id,name,weight_kg,bags_kg)
select t.id,v.name,v.weight,v.bags from (values
 ('T090','R. Patel',72,5),('T090','S. Patel',60,5),('T090','J. Moore',85,5),('T090','K. Moore',66,5),('T090','L. Chen',58,5),
 ('T091','D. Walsh',92,120),('T091','E. Okafor',78,90),('T091','P. Reid',84,60),
 ('T092','A. Becker',80,15),('T092','M. Becker',64,15),('T092','T. Hughes',90,15),('T092','C. Hughes',70,15),
 ('T093','G. Ross',82,40),('T093','H. Lam',75,40),
 ('T094','N. Silva',70,5),('T094','O. Silva',62,5),('T094','F. Brown',88,5),('T094','I. Brown',59,5),('T094','W. Kim',74,5),
 ('T095','B. Laurent',77,20),('T095','Y. Laurent',63,20),
 ('T097','Q. Nguyen',68,5),('T097','V. Nguyen',61,5),
 ('T098','G. Ross',82,40),('T098','U. Park',79,40),
 ('T101','E. Fitzgerald',75,20),('T101','R. Fitzgerald',80,20),('T101','A. Fitzgerald',62,20),('T101','M. Fitzgerald',70,20),
 ('T102','D. Walsh',92,200),('T102','E. Okafor',88,180),('T102','P. Reid',101,150),
 ('T104','Z. Adams',84,5),('T104','X. Adams',66,5)
) v(trip,name,weight,bags)
join trips t on t.code = v.trip
where not exists (select 1 from passengers p where p.trip_id = t.id and p.name = v.name);

insert into duties(crew_id,start_at,end_at,kind)
select c.id,(current_date + v.d + v.s::time) at time zone 'UTC',(current_date + v.d + v.e::time) at time zone 'UTC',v.kind
from (values
 ('BC',-25,'08:00','14:00','flying'),
 ('AN',-20,'08:00','12:00','flying'),
 ('ST',-10,'05:00','18:00','flying'),
 ('ST',-6,'06:00','17:00','flying'),
 ('ST',-5,'01:00','06:00','flying'),
 ('AN',-2,'07:00','17:00','flying'),
 ('AN',-1,'07:00','14:00','flying'),
 ('JW',-40,'08:00','12:00','flying'),
 ('MT',-60,'07:00','11:30','flying')
) v(crew,d,s,e,kind)
join crew c on c.code = v.crew
where not exists (select 1 from duties x where x.crew_id = c.id and x.start_at = (current_date + v.d + v.s::time) at time zone 'UTC');

insert into defects(code,aircraft_id,raised_on,description,deferred,due_on,cleared_on,cleared_ref)
select v.code,a.id,current_date + v.raised,v.description,v.deferred,
       case when v.due is null then null else current_date + v.due end, case when v.cleared is null then null else current_date + v.cleared end, v.ref
from (values
 ('DEF-01','VH-RXC',-3,'Tail rotor gearbox chip light on',false,null,null,null),
 ('DEF-02','ZK-HQA',-12,'Rear cabin door seal torn',true,-1,null,null),
 ('DEF-03','ZK-HQB',-4,'Landing light unserviceable',true,5,null,null),
 ('DEF-04','ZK-HQB',-30,'Pilot seat belt webbing fraying',false,null,-28,'WO-4410')
) v(code,aircraft,raised,description,deferred,due,cleared,ref)
join aircraft a on a.code = v.aircraft
on conflict (code) do nothing;

insert into notes(trip_id,body)
select t.id,'Lodge would like a Milford Sound landing if the weather allows. Confirm at 0700.' from trips t
where t.code = 'T101' and not exists (select 1 from notes n where n.trip_id = t.id);

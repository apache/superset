

INSERT INTO ab_view_menu
 (name)
VALUES
 ('UploadMenuItem'),
 ('Upload');

--select * from ab_view_menu order by id desc;



INSERT INTO ab_permission_view (permission_id, view_menu_id)
select
 p.id as permission_id,
 m.id as view_menu_id
from ab_view_menu m
 join (select id from ab_permission where name in ('menu_access')) p
where m.name = 'UploadMenuItem';

INSERT INTO ab_permission_view (permission_id, view_menu_id)
select
 p.id as permission_id,
 m.id as view_menu_id
from ab_view_menu m
 join (select id from ab_permission where name in ('can_read', 'can_write')) p
where m.name = 'Upload';

--select * from ab_permission_view order by id desc;



INSERT INTO ab_permission_view_role (permission_view_id, role_id)
select
 v.id as permission_view_id,
 r.id as role_id
from ab_permission_view v
 join ab_permission p on v.permission_id = p.id and p.name in ('menu_access')
 join ab_view_menu m on v.view_menu_id = m.id
 join (select id from ab_role where name in ('Admin', 'Alpha', 'Gamma')) r
where m.name = 'UploadMenuItem';

INSERT INTO ab_permission_view_role (permission_view_id, role_id)
select
 v.id as permission_view_id,
 r.id as role_id
from ab_permission_view v
 join ab_permission p on v.permission_id = p.id and p.name in ('can_read', 'can_write')
 join ab_view_menu m on v.view_menu_id = m.id
 join (select id from ab_role where name in ('Admin')) r
where m.name = 'Upload';

--select * from ab_permission_view_role order by id desc;



-- Adding new accesses didn't help
-- ------------------------------------------------------------
-- ------------------------------------------------------------

INSERT INTO ab_permission_view (permission_id, view_menu_id)
select
 p.id as permission_id,
 m.id as view_menu_id
from ab_view_menu m
 join (select id from ab_permission where name in ('can_add', 'can_delete', 'can_edit')) p
where m.name = 'Upload';

--select * from ab_permission_view order by id desc;



INSERT INTO ab_permission_view_role (permission_view_id, role_id)
select
 v.id as permission_view_id,
 r.id as role_id
from ab_permission_view v
 join ab_permission p on v.permission_id = p.id and p.name in ('can_add', 'can_delete', 'can_edit')
 join ab_view_menu m on v.view_menu_id = m.id
 join (select id from ab_role where name in ('Admin')) r
where m.name = 'Upload';

--select * from ab_permission_view_role order by id desc;

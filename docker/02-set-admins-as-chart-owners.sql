BEGIN;

DELETE FROM slice_user
WHERE user_id IN (
SELECT user_id
FROM ab_user_role
WHERE role_id in (SELECT id FROM ab_role WHERE name like '%Admin%'));

INSERT INTO slice_user(user_id, slice_id)
SELECT ur.user_id, s.id
FROM ab_user_role ur, slices s
WHERE ur.role_id in (SELECT id FROM ab_role WHERE name like '%Admin%');

COMMIT;

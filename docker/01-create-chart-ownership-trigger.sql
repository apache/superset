-- First, create the trigger function
CREATE OR REPLACE FUNCTION add_admin_role_function()
RETURNS TRIGGER AS $$
BEGIN

    DELETE FROM slice_user
    WHERE slice_id=NEW.id AND user_id IN (
    SELECT user_id
    FROM ab_user_role
    WHERE role_id in (SELECT id FROM ab_role WHERE name like '%Admin%'));

    INSERT INTO slice_user(user_id, slice_id)
    SELECT user_id, NEW.id
    FROM ab_user_role
    WHERE role_id in (SELECT id FROM ab_role WHERE name like '%Admin%');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Then, create the trigger using the function
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'add_admin_role') THEN
        CREATE TRIGGER add_admin_role
        AFTER INSERT OR UPDATE ON slices
        FOR EACH ROW EXECUTE FUNCTION add_admin_role_function();
    END IF;
END $$;
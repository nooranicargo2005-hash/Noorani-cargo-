-- Helper function for status breakdown stats
CREATE OR REPLACE FUNCTION get_status_counts()
RETURNS TABLE (status TEXT, count BIGINT) AS $$
BEGIN
    RETURN QUERY
    SELECT s.status, COUNT(*)
    FROM swbs s
    GROUP BY s.status;
END;
$$ LANGUAGE plpgsql;

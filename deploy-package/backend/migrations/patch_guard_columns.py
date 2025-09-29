from pathlib import Path
import re

p = Path("backend/migrations/versions/74a6f0eb42d3_init_schema.py")
s = p.read_text(encoding="utf-8")

# Guard for tags.created_at
created_pat = re.compile(r"op\.add_column\(\s*'tags'\s*,\s*sa\.Column\(\s*'created_at'")
created_guard = '''op.execute("""
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='tags' AND column_name='created_at'
    ) THEN
        ALTER TABLE tags ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    END IF;
END $$;
""")'''

# Replace the problematic line
n1 = len(created_pat.findall(s))
s = created_pat.sub(created_guard, s)

# Write back
p.write_text(s)
print(f"Patched {p} - found {n1} matches")

-- Team access: an account owner can invite teammates who then work inside the owner's dashboard.
CREATE TABLE IF NOT EXISTS team_members (
  owner_id   bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  member_id  bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, member_id),
  CHECK (owner_id <> member_id)
);
CREATE INDEX IF NOT EXISTS team_members_member_idx ON team_members (member_id);

CREATE TABLE IF NOT EXISTS team_invites (
  code       text PRIMARY KEY,
  owner_id   bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days',
  used_by    bigint
);

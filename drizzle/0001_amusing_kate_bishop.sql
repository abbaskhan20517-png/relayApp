CREATE INDEX `records_workspace_kind` ON `records` (`workspace`,`kind`);
--> statement-breakpoint
CREATE UNIQUE INDEX `contact_phone_unique` ON `records` (`workspace`,json_extract(data, '$.phone')) WHERE kind='contacts' AND json_extract(data, '$.phone') IS NOT NULL AND json_extract(data, '$.phone')!='';
--> statement-breakpoint
CREATE INDEX jobs_due ON jobs(state,kind,due);
--> statement-breakpoint
CREATE INDEX audit_workspace_created ON audit(workspace,created);
--> statement-breakpoint
CREATE INDEX sessions_user ON sessions(user);
--> statement-breakpoint
CREATE TRIGGER audit_no_update BEFORE UPDATE ON audit BEGIN SELECT RAISE(ABORT, 'Audit entries are immutable'); END;
--> statement-breakpoint
CREATE TRIGGER audit_no_delete BEFORE DELETE ON audit BEGIN SELECT RAISE(ABORT, 'Audit entries are immutable'); END;

CREATE TRIGGER record_insert_ref_0 BEFORE INSERT ON records WHEN NEW.kind IN ('leads','opportunities','messages','payments','appointments','notes','collections') AND NOT EXISTS(SELECT 1 FROM records c WHERE c.id=json_extract(NEW.data,'$.contact') AND c.workspace=NEW.workspace AND c.kind='contacts') BEGIN SELECT RAISE(ABORT, 'Customer reference is invalid'); END;
--> statement-breakpoint
CREATE TRIGGER record_insert_ref_1 BEFORE INSERT ON records WHEN NEW.kind='contacts' AND COALESCE(json_extract(NEW.data,'$.company'),'')!='' AND NOT EXISTS(SELECT 1 FROM records c WHERE c.id=json_extract(NEW.data,'$.company') AND c.workspace=NEW.workspace AND c.kind='companies') BEGIN SELECT RAISE(ABORT, 'Company reference is invalid'); END;
--> statement-breakpoint
CREATE TRIGGER record_insert_ref_2 BEFORE INSERT ON records WHEN NEW.kind='opportunities' AND NOT EXISTS(SELECT 1 FROM records p,json_each(p.data,'$.stages') st WHERE p.id=json_extract(NEW.data,'$.pipeline') AND p.workspace=NEW.workspace AND p.kind='pipelines' AND json_extract(st.value,'$.id')=json_extract(NEW.data,'$.stage')) BEGIN SELECT RAISE(ABORT, 'Pipeline or stage reference is invalid'); END;
--> statement-breakpoint
CREATE TRIGGER record_insert_ref_3 BEFORE INSERT ON records WHEN NEW.kind='fields' AND json_extract(NEW.data,'$.entity')='opportunities' AND NOT EXISTS(SELECT 1 FROM records p WHERE p.id=json_extract(NEW.data,'$.pipeline') AND p.workspace=NEW.workspace AND p.kind='pipelines') BEGIN SELECT RAISE(ABORT, 'Field pipeline reference is invalid'); END;
--> statement-breakpoint
CREATE TRIGGER record_insert_ref_4 BEFORE INSERT ON records WHEN NEW.kind IN ('leads','opportunities','appointments') AND NOT EXISTS(SELECT 1 FROM users u WHERE u.id=json_extract(NEW.data,'$.owner') AND u.workspace=NEW.workspace) BEGIN SELECT RAISE(ABORT, 'Owner reference is invalid'); END;
--> statement-breakpoint
CREATE TRIGGER record_update_ref_0 BEFORE UPDATE ON records WHEN NEW.kind IN ('leads','opportunities','messages','payments','appointments','notes','collections') AND NOT EXISTS(SELECT 1 FROM records c WHERE c.id=json_extract(NEW.data,'$.contact') AND c.workspace=NEW.workspace AND c.kind='contacts') BEGIN SELECT RAISE(ABORT, 'Customer reference is invalid'); END;
--> statement-breakpoint
CREATE TRIGGER record_update_ref_1 BEFORE UPDATE ON records WHEN NEW.kind='contacts' AND COALESCE(json_extract(NEW.data,'$.company'),'')!='' AND NOT EXISTS(SELECT 1 FROM records c WHERE c.id=json_extract(NEW.data,'$.company') AND c.workspace=NEW.workspace AND c.kind='companies') BEGIN SELECT RAISE(ABORT, 'Company reference is invalid'); END;
--> statement-breakpoint
CREATE TRIGGER record_update_ref_2 BEFORE UPDATE ON records WHEN NEW.kind='opportunities' AND NOT EXISTS(SELECT 1 FROM records p,json_each(p.data,'$.stages') st WHERE p.id=json_extract(NEW.data,'$.pipeline') AND p.workspace=NEW.workspace AND p.kind='pipelines' AND json_extract(st.value,'$.id')=json_extract(NEW.data,'$.stage')) BEGIN SELECT RAISE(ABORT, 'Pipeline or stage reference is invalid'); END;
--> statement-breakpoint
CREATE TRIGGER record_update_ref_3 BEFORE UPDATE ON records WHEN NEW.kind='fields' AND json_extract(NEW.data,'$.entity')='opportunities' AND NOT EXISTS(SELECT 1 FROM records p WHERE p.id=json_extract(NEW.data,'$.pipeline') AND p.workspace=NEW.workspace AND p.kind='pipelines') BEGIN SELECT RAISE(ABORT, 'Field pipeline reference is invalid'); END;
--> statement-breakpoint
CREATE TRIGGER record_update_ref_4 BEFORE UPDATE ON records WHEN NEW.kind IN ('leads','opportunities','appointments') AND NOT EXISTS(SELECT 1 FROM users u WHERE u.id=json_extract(NEW.data,'$.owner') AND u.workspace=NEW.workspace) BEGIN SELECT RAISE(ABORT, 'Owner reference is invalid'); END;
--> statement-breakpoint
CREATE TRIGGER records_safe_delete BEFORE DELETE ON records WHEN
(OLD.kind='contacts' AND EXISTS(SELECT 1 FROM records r WHERE r.workspace=OLD.workspace AND r.kind IN ('leads','opportunities','messages','payments','appointments','notes','collections') AND json_extract(r.data,'$.contact')=OLD.id)) OR
(OLD.kind='companies' AND EXISTS(SELECT 1 FROM records r WHERE r.workspace=OLD.workspace AND r.kind='contacts' AND json_extract(r.data,'$.company')=OLD.id)) OR
(OLD.kind='pipelines' AND EXISTS(SELECT 1 FROM records r WHERE r.workspace=OLD.workspace AND r.kind IN ('opportunities','fields') AND json_extract(r.data,'$.pipeline')=OLD.id))
BEGIN SELECT RAISE(ABORT, 'Related records must be moved before deletion'); END;
--> statement-breakpoint
CREATE TRIGGER pipeline_safe_stage_edit BEFORE UPDATE ON records WHEN NEW.kind='pipelines' AND EXISTS(SELECT 1 FROM records o WHERE o.workspace=NEW.workspace AND o.kind='opportunities' AND json_extract(o.data,'$.pipeline')=NEW.id AND NOT EXISTS(SELECT 1 FROM json_each(NEW.data,'$.stages') st WHERE json_extract(st.value,'$.id')=json_extract(o.data,'$.stage'))) BEGIN SELECT RAISE(ABORT, 'Move opportunities before deleting their stage'); END;

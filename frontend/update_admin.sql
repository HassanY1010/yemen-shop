DELETE FROM users WHERE role = 'admin';
INSERT INTO users (name, email, password, role, is_active) VALUES ('مدير المشروع', 'admin@admin.com', '873a958f4d518320fbbbca13376fc02a5de35337f4faed006cf4e657e045f020', 'admin', 1);

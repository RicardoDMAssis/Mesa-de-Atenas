-- Cards visuais criados antes da Fase 4.1: quem os desenha é quem os criou.
-- Cards de texto antigos vindos de plugins ficam sem dono (não há como saber a origem).
UPDATE `cards` SET `origin_plugin_id` = `plugin_id`
WHERE `type` = 'plugin' AND `plugin_id` IS NOT NULL AND `origin_plugin_id` IS NULL;

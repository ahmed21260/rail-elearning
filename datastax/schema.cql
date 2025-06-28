-- =====================================================
-- Schéma DataStax Astra pour Rail E-Learning
-- =====================================================

-- Créer le keyspace
CREATE KEYSPACE IF NOT EXISTS rail_elearning 
WITH replication = {
    'class': 'SimpleStrategy',
    'replication_factor': 3
};

USE rail_elearning;

-- =====================================================
-- TABLES POUR LES ANALYTICS
-- =====================================================

-- Table pour les événements utilisateur
CREATE TABLE IF NOT EXISTS user_events (
    user_id text,
    event_id timeuuid,
    event_type text,
    resource_type text,
    resource_id text,
    metadata map<text, text>,
    timestamp timestamp,
    session_id text,
    user_agent text,
    ip_address text,
    PRIMARY KEY ((user_id), event_id)
) WITH CLUSTERING ORDER BY (event_id DESC);

-- Index pour les événements par type
CREATE INDEX IF NOT EXISTS ON user_events (event_type);
CREATE INDEX IF NOT EXISTS ON user_events (resource_type);

-- Table pour les sessions utilisateur
CREATE TABLE IF NOT EXISTS user_sessions (
    user_id text,
    session_id text,
    start_time timestamp,
    end_time timestamp,
    duration_seconds int,
    page_views int,
    actions_count int,
    device_type text,
    browser text,
    os text,
    PRIMARY KEY ((user_id), session_id)
) WITH CLUSTERING ORDER BY (session_id DESC);

-- Table pour les métriques de performance
CREATE TABLE IF NOT EXISTS performance_metrics (
    metric_date date,
    metric_type text,
    metric_name text,
    metric_value double,
    timestamp timestamp,
    metadata map<text, text>,
    PRIMARY KEY ((metric_date, metric_type), metric_name, timestamp)
) WITH CLUSTERING ORDER BY (metric_name ASC, timestamp DESC);

-- =====================================================
-- TABLES POUR LES LOGS
-- =====================================================

-- Table pour les logs système
CREATE TABLE IF NOT EXISTS system_logs (
    log_date date,
    log_level text,
    log_id timeuuid,
    message text,
    details map<text, text>,
    timestamp timestamp,
    environment text,
    service_name text,
    PRIMARY KEY ((log_date, log_level), log_id)
) WITH CLUSTERING ORDER BY (log_id DESC);

-- Index pour les logs par environnement
CREATE INDEX IF NOT EXISTS ON system_logs (environment);

-- Table pour les logs d'erreur
CREATE TABLE IF NOT EXISTS error_logs (
    error_date date,
    error_type text,
    error_id timeuuid,
    error_message text,
    stack_trace text,
    user_id text,
    session_id text,
    timestamp timestamp,
    severity text,
    resolved boolean,
    PRIMARY KEY ((error_date, error_type), error_id)
) WITH CLUSTERING ORDER BY (error_id DESC);

-- =====================================================
-- TABLES POUR LES CONTENUS
-- =====================================================

-- Table pour les contenus de cours
CREATE TABLE IF NOT EXISTS course_contents (
    course_id text,
    version int,
    content_type text,
    content_data text,
    metadata map<text, text>,
    created_at timestamp,
    updated_at timestamp,
    created_by text,
    is_published boolean,
    PRIMARY KEY ((course_id), version)
) WITH CLUSTERING ORDER BY (version DESC);

-- Index pour les contenus par type
CREATE INDEX IF NOT EXISTS ON course_contents (content_type);

-- Table pour les versions de contenu
CREATE TABLE IF NOT EXISTS content_versions (
    content_id text,
    version int,
    previous_version int,
    change_summary text,
    changed_by text,
    changed_at timestamp,
    change_type text,
    PRIMARY KEY ((content_id), version)
) WITH CLUSTERING ORDER BY (version DESC);

-- =====================================================
-- TABLES POUR LES PROGRESSIONS
-- =====================================================

-- Table pour les progressions utilisateur
CREATE TABLE IF NOT EXISTS user_progress (
    user_id text,
    course_id text,
    lesson_id text,
    progress_data map<text, text>,
    completed boolean,
    score double,
    time_spent_seconds int,
    last_accessed timestamp,
    completed_at timestamp,
    attempts int,
    PRIMARY KEY ((user_id), course_id, lesson_id)
);

-- Index pour les progressions par cours
CREATE INDEX IF NOT EXISTS ON user_progress (course_id);

-- Table pour les statistiques de cours
CREATE TABLE IF NOT EXISTS course_stats (
    course_id text,
    stat_date date,
    stat_type text,
    stat_value double,
    user_count int,
    completion_rate double,
    avg_score double,
    avg_time_spent int,
    PRIMARY KEY ((course_id, stat_date), stat_type)
);

-- =====================================================
-- TABLES POUR LES QUIZ ET ÉVALUATIONS
-- =====================================================

-- Table pour les résultats de quiz
CREATE TABLE IF NOT EXISTS quiz_results (
    user_id text,
    quiz_id text,
    attempt_id timeuuid,
    score double,
    total_questions int,
    correct_answers int,
    time_taken_seconds int,
    completed_at timestamp,
    answers map<text, text>,
    PRIMARY KEY ((user_id), quiz_id, attempt_id)
) WITH CLUSTERING ORDER BY (quiz_id ASC, attempt_id DESC);

-- Table pour les statistiques de quiz
CREATE TABLE IF NOT EXISTS quiz_stats (
    quiz_id text,
    stat_date date,
    total_attempts int,
    avg_score double,
    completion_rate double,
    avg_time_taken int,
    difficulty_rating double,
    PRIMARY KEY ((quiz_id, stat_date), stat_date)
);

-- =====================================================
-- TABLES POUR LES ALERTES ET NOTIFICATIONS
-- =====================================================

-- Table pour les alertes d'urgence
CREATE TABLE IF NOT EXISTS emergency_alerts (
    alert_id timeuuid,
    alert_type text,
    priority text,
    title text,
    message text,
    location_lat double,
    location_lng double,
    radius_meters int,
    recipients set<text>,
    created_at timestamp,
    expires_at timestamp,
    is_active boolean,
    acknowledged_by set<text>,
    PRIMARY KEY (alert_id)
);

-- Index pour les alertes actives
CREATE INDEX IF NOT EXISTS ON emergency_alerts (is_active);
CREATE INDEX IF NOT EXISTS ON emergency_alerts (alert_type);

-- Table pour les notifications utilisateur
CREATE TABLE IF NOT EXISTS user_notifications (
    user_id text,
    notification_id timeuuid,
    notification_type text,
    title text,
    message text,
    read boolean,
    created_at timestamp,
    read_at timestamp,
    action_url text,
    metadata map<text, text>,
    PRIMARY KEY ((user_id), notification_id)
) WITH CLUSTERING ORDER BY (notification_id DESC);

-- =====================================================
-- TABLES POUR LA GÉOLOCALISATION
-- =====================================================

-- Table pour les positions utilisateur
CREATE TABLE IF NOT EXISTS user_locations (
    user_id text,
    location_id timeuuid,
    latitude double,
    longitude double,
    accuracy double,
    timestamp timestamp,
    device_id text,
    speed double,
    heading double,
    altitude double,
    PRIMARY KEY ((user_id), location_id)
) WITH CLUSTERING ORDER BY (location_id DESC);

-- Table pour les zones géographiques
CREATE TABLE IF NOT EXISTS geographic_zones (
    zone_id text,
    zone_name text,
    zone_type text,
    center_lat double,
    center_lng double,
    radius_meters int,
    boundaries list<frozen<tuple<double, double>>>,
    created_at timestamp,
    updated_at timestamp,
    is_active boolean,
    PRIMARY KEY (zone_id)
);

-- Index pour les zones par type
CREATE INDEX IF NOT EXISTS ON geographic_zones (zone_type);

-- =====================================================
-- TABLES POUR LES FLASHCARDS
-- =====================================================

-- Table pour les flashcards
CREATE TABLE IF NOT EXISTS flashcards (
    card_id text,
    course_id text,
    front_content text,
    back_content text,
    category text,
    difficulty text,
    tags set<text>,
    created_at timestamp,
    updated_at timestamp,
    created_by text,
    usage_count int,
    success_rate double,
    PRIMARY KEY ((course_id), card_id)
);

-- Index pour les flashcards par catégorie
CREATE INDEX IF NOT EXISTS ON flashcards (category);
CREATE INDEX IF NOT EXISTS ON flashcards (difficulty);

-- Table pour les sessions de flashcards
CREATE TABLE IF NOT EXISTS flashcard_sessions (
    user_id text,
    session_id timeuuid,
    course_id text,
    cards_reviewed int,
    correct_answers int,
    incorrect_answers int,
    time_spent_seconds int,
    started_at timestamp,
    completed_at timestamp,
    PRIMARY KEY ((user_id), session_id)
) WITH CLUSTERING ORDER BY (session_id DESC);

-- =====================================================
-- TABLES POUR LES ANALYTICS AVANCÉES
-- =====================================================

-- Table pour les patterns d'apprentissage
CREATE TABLE IF NOT EXISTS learning_patterns (
    user_id text,
    pattern_date date,
    pattern_type text,
    pattern_data map<text, text>,
    confidence_score double,
    created_at timestamp,
    PRIMARY KEY ((user_id, pattern_date), pattern_type)
);

-- Table pour les recommandations
CREATE TABLE IF NOT EXISTS user_recommendations (
    user_id text,
    recommendation_id timeuuid,
    recommendation_type text,
    resource_id text,
    resource_type text,
    score double,
    reason text,
    created_at timestamp,
    viewed boolean,
    acted_upon boolean,
    PRIMARY KEY ((user_id), recommendation_id)
) WITH CLUSTERING ORDER BY (recommendation_id DESC);

-- =====================================================
-- TABLES POUR LES INTÉGRATIONS
-- =====================================================

-- Table pour les intégrations externes
CREATE TABLE IF NOT EXISTS external_integrations (
    integration_id text,
    integration_type text,
    integration_name text,
    config_data map<text, text>,
    is_active boolean,
    last_sync timestamp,
    sync_status text,
    error_count int,
    created_at timestamp,
    updated_at timestamp,
    PRIMARY KEY (integration_id)
);

-- Table pour les données synchronisées
CREATE TABLE IF NOT EXISTS synced_data (
    sync_id timeuuid,
    integration_id text,
    data_type text,
    external_id text,
    internal_id text,
    data_hash text,
    sync_timestamp timestamp,
    sync_status text,
    error_message text,
    PRIMARY KEY ((integration_id), sync_id)
) WITH CLUSTERING ORDER BY (sync_id DESC);

-- =====================================================
-- VUES ET INDEX SUPPLÉMENTAIRES
-- =====================================================

-- Index pour les recherches textuelles
CREATE INDEX IF NOT EXISTS ON course_contents (content_data);
CREATE INDEX IF NOT EXISTS ON system_logs (message);

-- Index pour les requêtes temporelles
CREATE INDEX IF NOT EXISTS ON user_events (timestamp);
CREATE INDEX IF NOT EXISTS ON system_logs (timestamp);
CREATE INDEX IF NOT EXISTS ON emergency_alerts (created_at);

-- =====================================================
-- DONNÉES D'EXEMPLE
-- =====================================================

-- Insérer des données d'exemple pour les tests
INSERT INTO system_logs (log_date, log_level, log_id, message, details, timestamp, environment, service_name)
VALUES (
    toDate(now()),
    'info',
    now(),
    'Base de données initialisée avec succès',
    {'version': '1.0.0', 'schema': 'rail_elearning'},
    toTimestamp(now()),
    'development',
    'astra-client'
);

-- Insérer une alerte d'exemple
INSERT INTO emergency_alerts (alert_id, alert_type, priority, title, message, location_lat, location_lng, radius_meters, recipients, created_at, is_active)
VALUES (
    now(),
    'maintenance',
    'medium',
    'Maintenance préventive',
    'Maintenance préventive programmée sur la ligne A',
    48.8566,
    2.3522,
    5000,
    {'user1', 'user2', 'user3'},
    toTimestamp(now()),
    true
); 
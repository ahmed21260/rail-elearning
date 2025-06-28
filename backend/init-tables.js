require('dotenv').config();
const axios = require('axios');

// Configuration Astra
const ASTRA_DB_ID = process.env.ASTRA_DB_ID;
const ASTRA_DB_REGION = process.env.ASTRA_DB_REGION;
const ASTRA_DB_KEYSPACE = process.env.ASTRA_DB_KEYSPACE;
const ASTRA_DB_APPLICATION_TOKEN = process.env.ASTRA_DB_APPLICATION_TOKEN;

if (!ASTRA_DB_ID || !ASTRA_DB_REGION || !ASTRA_DB_KEYSPACE || !ASTRA_DB_APPLICATION_TOKEN) {
  console.error('❌ Variables d\'environnement Astra manquantes');
  process.exit(1);
}

const BASE_URL = `https://${ASTRA_DB_ID}-${ASTRA_DB_REGION}.apps.astra.datastax.com/api/rest/v2/keyspaces/${ASTRA_DB_KEYSPACE}`;
const HEADERS = { 
  'X-Cassandra-Token': ASTRA_DB_APPLICATION_TOKEN,
  'Content-Type': 'application/json'
};

// Définition des tables
const tables = [
  {
    name: 'courses',
    columnDefinitions: [
      { name: 'id', typeDefinition: 'uuid' },
      { name: 'title', typeDefinition: 'text' },
      { name: 'description', typeDefinition: 'text' },
      { name: 'instructor', typeDefinition: 'text' },
      { name: 'category', typeDefinition: 'text' },
      { name: 'level', typeDefinition: 'text' },
      { name: 'duration', typeDefinition: 'int' },
      { name: 'thumbnail', typeDefinition: 'text' },
      { name: 'is_required', typeDefinition: 'boolean' },
      { name: 'rating', typeDefinition: 'decimal' },
      { name: 'enrolled_count', typeDefinition: 'int' },
      { name: 'created_at', typeDefinition: 'timestamp' },
      { name: 'updated_at', typeDefinition: 'timestamp' }
    ],
    primaryKey: { partitionKey: ['id'] }
  },
  {
    name: 'quiz',
    columnDefinitions: [
      { name: 'id', typeDefinition: 'uuid' },
      { name: 'course_id', typeDefinition: 'uuid' },
      { name: 'question', typeDefinition: 'text' },
      { name: 'type', typeDefinition: 'text' },
      { name: 'options', typeDefinition: 'list<text>' },
      { name: 'correct_answer', typeDefinition: 'text' },
      { name: 'explanation', typeDefinition: 'text' },
      { name: 'points', typeDefinition: 'int' },
      { name: 'time_limit', typeDefinition: 'int' },
      { name: 'created_at', typeDefinition: 'timestamp' }
    ],
    primaryKey: { partitionKey: ['id'] }
  },
  {
    name: 'flashcards',
    columnDefinitions: [
      { name: 'id', typeDefinition: 'uuid' },
      { name: 'course_id', typeDefinition: 'uuid' },
      { name: 'front', typeDefinition: 'text' },
      { name: 'back', typeDefinition: 'text' },
      { name: 'category', typeDefinition: 'text' },
      { name: 'difficulty', typeDefinition: 'text' },
      { name: 'review_count', typeDefinition: 'int' },
      { name: 'mastery_level', typeDefinition: 'int' },
      { name: 'last_reviewed', typeDefinition: 'timestamp' },
      { name: 'created_at', typeDefinition: 'timestamp' }
    ],
    primaryKey: { partitionKey: ['id'] }
  },
  {
    name: 'user_analytics',
    columnDefinitions: [
      { name: 'id', typeDefinition: 'uuid' },
      { name: 'user_id', typeDefinition: 'text' },
      { name: 'action', typeDefinition: 'text' },
      { name: 'resource_type', typeDefinition: 'text' },
      { name: 'resource_id', typeDefinition: 'text' },
      { name: 'metadata', typeDefinition: 'map<text, text>' },
      { name: 'timestamp', typeDefinition: 'timestamp' }
    ],
    primaryKey: { partitionKey: ['id'] }
  },
  {
    name: 'user_progress',
    columnDefinitions: [
      { name: 'user_id', typeDefinition: 'text' },
      { name: 'course_id', typeDefinition: 'uuid' },
      { name: 'progress_percentage', typeDefinition: 'decimal' },
      { name: 'completed_modules', typeDefinition: 'list<text>' },
      { name: 'quiz_scores', typeDefinition: 'map<text, int>' },
      { name: 'time_spent', typeDefinition: 'int' },
      { name: 'last_accessed', typeDefinition: 'timestamp' },
      { name: 'created_at', typeDefinition: 'timestamp' },
      { name: 'updated_at', typeDefinition: 'timestamp' }
    ],
    primaryKey: { partitionKey: ['user_id'], clusteringKey: ['course_id'] }
  },
  {
    name: 'alerts',
    columnDefinitions: [
      { name: 'id', typeDefinition: 'uuid' },
      { name: 'type', typeDefinition: 'text' },
      { name: 'severity', typeDefinition: 'text' },
      { name: 'title', typeDefinition: 'text' },
      { name: 'message', typeDefinition: 'text' },
      { name: 'location', typeDefinition: 'text' },
      { name: 'coordinates', typeDefinition: 'map<text, decimal>' },
      { name: 'affected_users', typeDefinition: 'list<text>' },
      { name: 'is_active', typeDefinition: 'boolean' },
      { name: 'created_at', typeDefinition: 'timestamp' },
      { name: 'expires_at', typeDefinition: 'timestamp' }
    ],
    primaryKey: { partitionKey: ['id'] }
  },
  {
    name: 'geolocation_data',
    columnDefinitions: [
      { name: 'id', typeDefinition: 'uuid' },
      { name: 'user_id', typeDefinition: 'text' },
      { name: 'latitude', typeDefinition: 'decimal' },
      { name: 'longitude', typeDefinition: 'decimal' },
      { name: 'accuracy', typeDefinition: 'decimal' },
      { name: 'speed', typeDefinition: 'decimal' },
      { name: 'heading', typeDefinition: 'decimal' },
      { name: 'altitude', typeDefinition: 'decimal' },
      { name: 'timestamp', typeDefinition: 'timestamp' }
    ],
    primaryKey: { partitionKey: ['user_id'], clusteringKey: ['timestamp'] }
  }
];

// Données d'exemple
const sampleData = {
  courses: [
    {
      id: '550e8400-e29b-41d4-a716-446655440001',
      title: 'Sécurité ferroviaire de base',
      description: 'Formation essentielle sur les règles de sécurité dans l\'environnement ferroviaire',
      instructor: 'Jean Dupont',
      category: 'Sécurité',
      level: 'débutant',
      duration: 120,
      thumbnail: 'https://example.com/security-thumb.jpg',
      is_required: true,
      rating: 4.5,
      enrolled_count: 150,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440002',
      title: 'Maintenance des signaux',
      description: 'Apprentissage de la maintenance et du dépannage des systèmes de signalisation',
      instructor: 'Marie Martin',
      category: 'Maintenance',
      level: 'intermédiaire',
      duration: 180,
      thumbnail: 'https://example.com/signals-thumb.jpg',
      is_required: false,
      rating: 4.2,
      enrolled_count: 85,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ],
  quiz: [
    {
      id: '550e8400-e29b-41d4-a716-446655440003',
      course_id: '550e8400-e29b-41d4-a716-446655440001',
      question: 'Quelle est la première règle de sécurité sur un chantier ferroviaire ?',
      type: 'multiple-choice',
      options: ['Porter un casque', 'Signaler sa présence', 'Rester à distance', 'Toutes ces réponses'],
      correct_answer: 'Toutes ces réponses',
      explanation: 'La sécurité ferroviaire nécessite plusieurs mesures simultanées',
      points: 10,
      time_limit: 60,
      created_at: new Date().toISOString()
    }
  ],
  flashcards: [
    {
      id: '550e8400-e29b-41d4-a716-446655440004',
      course_id: '550e8400-e29b-41d4-a716-446655440001',
      front: 'Code de signalisation rouge',
      back: 'Arrêt obligatoire - Danger immédiat',
      category: 'Signalisation',
      difficulty: 'facile',
      review_count: 0,
      mastery_level: 0,
      created_at: new Date().toISOString()
    }
  ]
};

async function createTable(tableDefinition) {
  try {
    console.log(`📋 Création de la table: ${tableDefinition.name}`);
    await axios.post(`${BASE_URL}/tables`, tableDefinition, { headers: HEADERS });
    console.log(`✅ Table ${tableDefinition.name} créée avec succès`);
    return true;
  } catch (error) {
    if (error.response?.status === 409) {
      console.log(`ℹ️  Table ${tableDefinition.name} existe déjà`);
      return true;
    }
    console.error(`❌ Erreur création table ${tableDefinition.name}:`, error.response?.data?.description || error.message);
    return false;
  }
}

async function insertSampleData(tableName, data) {
  try {
    console.log(`📝 Insertion de données d'exemple dans ${tableName}...`);
    for (const item of data) {
      await axios.post(`${BASE_URL}/${tableName}`, item, { headers: HEADERS });
    }
    console.log(`✅ ${data.length} enregistrements insérés dans ${tableName}`);
    return true;
  } catch (error) {
    console.error(`❌ Erreur insertion données ${tableName}:`, error.response?.data?.description || error.message);
    return false;
  }
}

async function initializeDatabase() {
  console.log('🚀 Initialisation de la base de données Astra...');
  console.log(`🌐 Keyspace: ${ASTRA_DB_KEYSPACE}`);
  console.log(`🔗 URL: ${BASE_URL}\n`);

  // Créer les tables
  console.log('📋 Création des tables...');
  let successCount = 0;
  for (const table of tables) {
    const success = await createTable(table);
    if (success) successCount++;
  }
  console.log(`\n✅ ${successCount}/${tables.length} tables créées avec succès\n`);

  // Insérer les données d'exemple
  console.log('📝 Insertion des données d\'exemple...');
  for (const [tableName, data] of Object.entries(sampleData)) {
    await insertSampleData(tableName, data);
  }

  console.log('\n🎉 Initialisation terminée !');
  console.log('\n📊 Tables créées:');
  tables.forEach(table => console.log(`   - ${table.name}`));
  
  console.log('\n📝 Données d\'exemple insérées:');
  Object.keys(sampleData).forEach(table => console.log(`   - ${table}`));
  
  console.log('\n🔗 Votre API est prête à être utilisée !');
  console.log('💡 Utilisez "npm start" pour démarrer l\'API');
}

// Exécuter l'initialisation
initializeDatabase().catch(console.error); 
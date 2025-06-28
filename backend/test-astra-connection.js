require('dotenv').config();
const axios = require('axios');

// Vérification des variables d'environnement
const requiredEnvVars = [
  'ASTRA_DB_ID',
  'ASTRA_DB_REGION', 
  'ASTRA_DB_KEYSPACE',
  'ASTRA_DB_APPLICATION_TOKEN'
];

console.log('🔍 Vérification des variables d\'environnement...');
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ Variable manquante: ${envVar}`);
    process.exit(1);
  }
  console.log(`✅ ${envVar}: ${envVar.includes('TOKEN') ? '***' : process.env[envVar]}`);
}

// Configuration de la connexion Astra
const ASTRA_DB_ID = process.env.ASTRA_DB_ID;
const ASTRA_DB_REGION = process.env.ASTRA_DB_REGION;
const ASTRA_DB_KEYSPACE = process.env.ASTRA_DB_KEYSPACE;
const ASTRA_DB_APPLICATION_TOKEN = process.env.ASTRA_DB_APPLICATION_TOKEN;

const BASE_URL = `https://${ASTRA_DB_ID}-${ASTRA_DB_REGION}.apps.astra.datastax.com/api/rest/v2/keyspaces/${ASTRA_DB_KEYSPACE}`;
const HEADERS = { 
  'X-Cassandra-Token': ASTRA_DB_APPLICATION_TOKEN,
  'Content-Type': 'application/json'
};

console.log('\n🌐 URL de base Astra:', BASE_URL);

// Test de connexion
async function testAstraConnection() {
  try {
    console.log('\n🔌 Test de connexion à Astra...');
    
    // Test 1: Vérifier l'accès au keyspace
    console.log('📋 Test 1: Accès au keyspace...');
    const keyspaceResponse = await axios.get(`${BASE_URL}`, { headers: HEADERS });
    console.log('✅ Connexion au keyspace réussie');
    
    // Test 2: Lister les tables (si elles existent)
    console.log('\n📊 Test 2: Liste des tables...');
    try {
      const tablesResponse = await axios.get(`${BASE_URL}/tables`, { headers: HEADERS });
      console.log('✅ Tables trouvées:', tablesResponse.data.data?.length || 0);
      if (tablesResponse.data.data) {
        tablesResponse.data.data.forEach(table => {
          console.log(`   - ${table.name}`);
        });
      }
    } catch (error) {
      console.log('ℹ️  Aucune table trouvée (normal si pas encore créées)');
    }
    
    // Test 3: Créer une table de test
    console.log('\n🧪 Test 3: Création d\'une table de test...');
    const testTableData = {
      name: 'test_connection',
      columnDefinitions: [
        { name: 'id', typeDefinition: 'uuid' },
        { name: 'message', typeDefinition: 'text' },
        { name: 'created_at', typeDefinition: 'timestamp' }
      ],
      primaryKey: { partitionKey: ['id'] }
    };
    
    try {
      await axios.post(`${BASE_URL}/tables`, testTableData, { headers: HEADERS });
      console.log('✅ Table de test créée');
      
      // Insérer une donnée de test
      const testData = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        message: 'Connexion Astra réussie !',
        created_at: new Date().toISOString()
      };
      
      await axios.post(`${BASE_URL}/test_connection`, testData, { headers: HEADERS });
      console.log('✅ Donnée de test insérée');
      
      // Lire la donnée
      const readResponse = await axios.get(`${BASE_URL}/test_connection/${testData.id}`, { headers: HEADERS });
      console.log('✅ Donnée lue:', readResponse.data.data);
      
      // Supprimer la table de test
      await axios.delete(`${BASE_URL}/tables/test_connection`, { headers: HEADERS });
      console.log('✅ Table de test supprimée');
      
    } catch (error) {
      console.log('ℹ️  Table de test déjà existante ou erreur:', error.response?.data?.description || error.message);
    }
    
    console.log('\n🎉 Tous les tests de connexion Astra sont réussis !');
    console.log('\n📝 Prochaines étapes:');
    console.log('1. Créez vos tables avec le script CQL');
    console.log('2. Déployez votre API Node.js');
    console.log('3. Configurez votre frontend React');
    
  } catch (error) {
    console.error('\n❌ Erreur de connexion Astra:');
    console.error('Message:', error.response?.data?.description || error.message);
    console.error('Status:', error.response?.status);
    console.error('URL:', error.config?.url);
    
    console.log('\n🔧 Solutions possibles:');
    console.log('1. Vérifiez que votre token est correct');
    console.log('2. Vérifiez que votre keyspace existe');
    console.log('3. Vérifiez que votre région est correcte');
    console.log('4. Vérifiez que votre base de données est active');
    
    process.exit(1);
  }
}

// Exécuter le test
testAstraConnection(); 
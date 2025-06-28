require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const app = express();

// Configuration de sécurité
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limite chaque IP à 100 requêtes par fenêtre
});
app.use(limiter);

app.use(express.json({ limit: '10mb' }));

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

console.log('🚀 API RailEdu démarrée');
console.log('🌐 URL Astra:', BASE_URL);

// Middleware de logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes de santé
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    astra: {
      connected: true,
      keyspace: ASTRA_DB_KEYSPACE
    }
  });
});

// ===== COURS =====

// Liste des cours
app.get('/api/courses', async (req, res) => {
  try {
    const { data } = await axios.get(`${BASE_URL}/courses`, { headers: HEADERS });
    res.json({
      success: true,
      data: data.data || [],
      count: data.data?.length || 0
    });
  } catch (error) {
    console.error('Erreur récupération cours:', error.response?.data || error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Erreur lors de la récupération des cours' 
    });
  }
});

// Cours par ID
app.get('/api/courses/:id', async (req, res) => {
  try {
    const { data } = await axios.get(`${BASE_URL}/courses/${req.params.id}`, { headers: HEADERS });
    res.json({
      success: true,
      data: data.data
    });
  } catch (error) {
    if (error.response?.status === 404) {
      return res.status(404).json({ 
        success: false, 
        error: 'Cours non trouvé' 
      });
    }
    res.status(500).json({ 
      success: false, 
      error: 'Erreur lors de la récupération du cours' 
    });
  }
});

// Créer un cours
app.post('/api/courses', async (req, res) => {
  try {
    const courseData = {
      id: uuidv4(),
      ...req.body,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    await axios.post(`${BASE_URL}/courses`, courseData, { headers: HEADERS });
    res.status(201).json({
      success: true,
      data: courseData,
      message: 'Cours créé avec succès'
    });
  } catch (error) {
    console.error('Erreur création cours:', error.response?.data || error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Erreur lors de la création du cours' 
    });
  }
});

// Mettre à jour un cours
app.put('/api/courses/:id', async (req, res) => {
  try {
    const updateData = {
      ...req.body,
      updated_at: new Date().toISOString()
    };
    
    await axios.put(`${BASE_URL}/courses/${req.params.id}`, updateData, { headers: HEADERS });
    res.json({
      success: true,
      message: 'Cours mis à jour avec succès'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Erreur lors de la mise à jour du cours' 
    });
  }
});

// Supprimer un cours
app.delete('/api/courses/:id', async (req, res) => {
  try {
    await axios.delete(`${BASE_URL}/courses/${req.params.id}`, { headers: HEADERS });
    res.json({
      success: true,
      message: 'Cours supprimé avec succès'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Erreur lors de la suppression du cours' 
    });
  }
});

// ===== QUIZ =====

// Liste des quiz
app.get('/api/quiz', async (req, res) => {
  try {
    const { data } = await axios.get(`${BASE_URL}/quiz`, { headers: HEADERS });
    res.json({
      success: true,
      data: data.data || [],
      count: data.data?.length || 0
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Erreur lors de la récupération des quiz' 
    });
  }
});

// Quiz par cours
app.get('/api/courses/:courseId/quiz', async (req, res) => {
  try {
    const { data } = await axios.get(`${BASE_URL}/quiz?where={"course_id":{"$eq":"${req.params.courseId}"}}`, { headers: HEADERS });
    res.json({
      success: true,
      data: data.data || [],
      count: data.data?.length || 0
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Erreur lors de la récupération des quiz du cours' 
    });
  }
});

// Créer un quiz
app.post('/api/quiz', async (req, res) => {
  try {
    const quizData = {
      id: uuidv4(),
      ...req.body,
      created_at: new Date().toISOString()
    };
    
    await axios.post(`${BASE_URL}/quiz`, quizData, { headers: HEADERS });
    res.status(201).json({
      success: true,
      data: quizData,
      message: 'Quiz créé avec succès'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Erreur lors de la création du quiz' 
    });
  }
});

// ===== FLASHCARDS =====

// Liste des flashcards
app.get('/api/flashcards', async (req, res) => {
  try {
    const { data } = await axios.get(`${BASE_URL}/flashcards`, { headers: HEADERS });
    res.json({
      success: true,
      data: data.data || [],
      count: data.data?.length || 0
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Erreur lors de la récupération des flashcards' 
    });
  }
});

// Flashcards par cours
app.get('/api/courses/:courseId/flashcards', async (req, res) => {
  try {
    const { data } = await axios.get(`${BASE_URL}/flashcards?where={"course_id":{"$eq":"${req.params.courseId}"}}`, { headers: HEADERS });
    res.json({
      success: true,
      data: data.data || [],
      count: data.data?.length || 0
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Erreur lors de la récupération des flashcards du cours' 
    });
  }
});

// Créer une flashcard
app.post('/api/flashcards', async (req, res) => {
  try {
    const flashcardData = {
      id: uuidv4(),
      ...req.body,
      review_count: 0,
      mastery_level: 0,
      created_at: new Date().toISOString()
    };
    
    await axios.post(`${BASE_URL}/flashcards`, flashcardData, { headers: HEADERS });
    res.status(201).json({
      success: true,
      data: flashcardData,
      message: 'Flashcard créée avec succès'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Erreur lors de la création de la flashcard' 
    });
  }
});

// Mettre à jour une flashcard (révision)
app.put('/api/flashcards/:id', async (req, res) => {
  try {
    const updateData = {
      ...req.body,
      last_reviewed: new Date().toISOString()
    };
    
    await axios.put(`${BASE_URL}/flashcards/${req.params.id}`, updateData, { headers: HEADERS });
    res.json({
      success: true,
      message: 'Flashcard mise à jour avec succès'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Erreur lors de la mise à jour de la flashcard' 
    });
  }
});

// ===== ANALYTICS =====

// Enregistrer une activité utilisateur
app.post('/api/analytics', async (req, res) => {
  try {
    const analyticsData = {
      id: uuidv4(),
      user_id: req.body.user_id,
      action: req.body.action,
      resource_type: req.body.resource_type,
      resource_id: req.body.resource_id,
      metadata: req.body.metadata || {},
      timestamp: new Date().toISOString()
    };
    
    await axios.post(`${BASE_URL}/user_analytics`, analyticsData, { headers: HEADERS });
    res.status(201).json({
      success: true,
      message: 'Activité enregistrée'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Erreur lors de l\'enregistrement de l\'activité' 
    });
  }
});

// Statistiques utilisateur
app.get('/api/analytics/user/:userId', async (req, res) => {
  try {
    const { data } = await axios.get(`${BASE_URL}/user_analytics?where={"user_id":{"$eq":"${req.params.userId}"}}`, { headers: HEADERS });
    res.json({
      success: true,
      data: data.data || [],
      count: data.data?.length || 0
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Erreur lors de la récupération des statistiques' 
    });
  }
});

// ===== GESTION D'ERREURS =====

app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    error: 'Route non trouvée' 
  });
});

app.use((error, req, res, next) => {
  console.error('Erreur serveur:', error);
  res.status(500).json({ 
    success: false, 
    error: 'Erreur interne du serveur' 
  });
});

// Démarrage du serveur
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`📚 API docs: http://localhost:${PORT}/api`);
});

module.exports = app; 
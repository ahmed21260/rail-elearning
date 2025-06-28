const { Client } = require('@datastax/astra-db-js');

// Configuration DataStax Astra
const ASTRA_DB_ID = process.env.ASTRA_DB_ID;
const ASTRA_DB_REGION = process.env.ASTRA_DB_REGION;
const ASTRA_DB_KEYSPACE = process.env.ASTRA_DB_KEYSPACE;
const ASTRA_DB_APPLICATION_TOKEN = process.env.ASTRA_DB_APPLICATION_TOKEN;

// Initialiser le client Astra
const client = new Client({
  astraDatabaseId: ASTRA_DB_ID,
  astraDatabaseRegion: ASTRA_DB_REGION,
  applicationToken: ASTRA_DB_APPLICATION_TOKEN,
});

// Collection pour les analytics
const analyticsCollection = client.namespace(ASTRA_DB_KEYSPACE).collection('analytics');

// Collection pour les logs
const logsCollection = client.namespace(ASTRA_DB_KEYSPACE).collection('logs');

// Collection pour les contenus
const contentsCollection = client.namespace(ASTRA_DB_KEYSPACE).collection('contents');

// Fonctions pour les analytics
class AnalyticsService {
  // Enregistrer une action utilisateur
  static async logUserAction(userId, action, resource, resourceId, metadata = {}) {
    try {
      const analyticsData = {
        userId,
        action,
        resource,
        resourceId,
        metadata,
        timestamp: new Date(),
        sessionId: metadata.sessionId || 'unknown',
        userAgent: metadata.userAgent || 'unknown',
        ipAddress: metadata.ipAddress || null,
      };

      await analyticsCollection.create(analyticsData);
      console.log('Analytics logged:', action);
    } catch (error) {
      console.error('Erreur lors de l\'enregistrement analytics:', error);
    }
  }

  // Récupérer les analytics d'un utilisateur
  static async getUserAnalytics(userId, startDate, endDate) {
    try {
      const query = {
        userId,
        timestamp: {
          $gte: startDate,
          $lte: endDate,
        },
      };

      const result = await analyticsCollection.find(query);
      return result.data;
    } catch (error) {
      console.error('Erreur lors de la récupération des analytics:', error);
      return [];
    }
  }

  // Récupérer les statistiques globales
  static async getGlobalStats() {
    try {
      const pipeline = [
        {
          $group: {
            _id: '$action',
            count: { $sum: 1 },
            uniqueUsers: { $addToSet: '$userId' },
          },
        },
        {
          $project: {
            action: '$_id',
            count: 1,
            uniqueUsers: { $size: '$uniqueUsers' },
          },
        },
      ];

      const result = await analyticsCollection.aggregate(pipeline);
      return result.data;
    } catch (error) {
      console.error('Erreur lors de la récupération des stats globales:', error);
      return [];
    }
  }
}

// Fonctions pour les logs
class LogService {
  // Enregistrer un log système
  static async logSystemEvent(level, message, details = {}) {
    try {
      const logData = {
        level, // 'info', 'warning', 'error', 'critical'
        message,
        details,
        timestamp: new Date(),
        environment: process.env.NODE_ENV || 'development',
      };

      await logsCollection.create(logData);
      console.log(`[${level.toUpperCase()}] ${message}`);
    } catch (error) {
      console.error('Erreur lors de l\'enregistrement du log:', error);
    }
  }

  // Récupérer les logs par niveau
  static async getLogsByLevel(level, limit = 100) {
    try {
      const query = { level };
      const result = await logsCollection.find(query, { limit, sort: { timestamp: -1 } });
      return result.data;
    } catch (error) {
      console.error('Erreur lors de la récupération des logs:', error);
      return [];
    }
  }

  // Récupérer les logs d'erreur récents
  static async getRecentErrors(limit = 50) {
    try {
      const query = { level: { $in: ['error', 'critical'] } };
      const result = await logsCollection.find(query, { limit, sort: { timestamp: -1 } });
      return result.data;
    } catch (error) {
      console.error('Erreur lors de la récupération des erreurs:', error);
      return [];
    }
  }
}

// Fonctions pour les contenus
class ContentService {
  // Stocker du contenu de cours
  static async storeCourseContent(courseId, content, metadata = {}) {
    try {
      const contentData = {
        courseId,
        content,
        metadata,
        createdAt: new Date(),
        updatedAt: new Date(),
        version: metadata.version || 1,
      };

      await contentsCollection.create(contentData);
      console.log('Contenu de cours stocké:', courseId);
    } catch (error) {
      console.error('Erreur lors du stockage du contenu:', error);
      throw error;
    }
  }

  // Récupérer le contenu d'un cours
  static async getCourseContent(courseId, version = null) {
    try {
      const query = { courseId };
      if (version) {
        query.version = version;
      }

      const result = await contentsCollection.find(query, { sort: { version: -1 }, limit: 1 });
      return result.data[0] || null;
    } catch (error) {
      console.error('Erreur lors de la récupération du contenu:', error);
      return null;
    }
  }

  // Mettre à jour le contenu d'un cours
  static async updateCourseContent(courseId, content, metadata = {}) {
    try {
      const existingContent = await this.getCourseContent(courseId);
      const newVersion = existingContent ? existingContent.version + 1 : 1;

      const contentData = {
        courseId,
        content,
        metadata: { ...metadata, previousVersion: existingContent?.version },
        createdAt: existingContent?.createdAt || new Date(),
        updatedAt: new Date(),
        version: newVersion,
      };

      await contentsCollection.create(contentData);
      console.log('Contenu de cours mis à jour:', courseId, 'version:', newVersion);
    } catch (error) {
      console.error('Erreur lors de la mise à jour du contenu:', error);
      throw error;
    }
  }
}

// Fonctions pour les performances
class PerformanceService {
  // Mesurer les performances d'une requête
  static async measureQueryPerformance(queryName, queryFunction) {
    const startTime = Date.now();
    try {
      const result = await queryFunction();
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Enregistrer la performance
      await LogService.logSystemEvent('info', `Query performance: ${queryName}`, {
        duration,
        success: true,
        queryName,
      });

      return { result, duration, success: true };
    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Enregistrer l'erreur
      await LogService.logSystemEvent('error', `Query error: ${queryName}`, {
        duration,
        success: false,
        queryName,
        error: error.message,
      });

      throw error;
    }
  }

  // Récupérer les statistiques de performance
  static async getPerformanceStats(timeRange = '24h') {
    try {
      const startDate = new Date();
      if (timeRange === '24h') {
        startDate.setHours(startDate.getHours() - 24);
      } else if (timeRange === '7d') {
        startDate.setDate(startDate.getDate() - 7);
      } else if (timeRange === '30d') {
        startDate.setDate(startDate.getDate() - 30);
      }

      const query = {
        timestamp: { $gte: startDate },
        'details.queryName': { $exists: true },
      };

      const result = await logsCollection.find(query);
      return result.data;
    } catch (error) {
      console.error('Erreur lors de la récupération des stats de performance:', error);
      return [];
    }
  }
}

// Fonctions utilitaires
class Utils {
  // Vérifier la connexion à Astra
  static async checkConnection() {
    try {
      await client.connect();
      console.log('Connexion Astra établie avec succès');
      return true;
    } catch (error) {
      console.error('Erreur de connexion Astra:', error);
      return false;
    }
  }

  // Fermer la connexion
  static async closeConnection() {
    try {
      await client.close();
      console.log('Connexion Astra fermée');
    } catch (error) {
      console.error('Erreur lors de la fermeture de la connexion:', error);
    }
  }

  // Créer les index nécessaires
  static async createIndexes() {
    try {
      // Index pour les analytics
      await analyticsCollection.createIndex('userId_timestamp', ['userId', 'timestamp']);
      await analyticsCollection.createIndex('action_timestamp', ['action', 'timestamp']);

      // Index pour les logs
      await logsCollection.createIndex('level_timestamp', ['level', 'timestamp']);
      await logsCollection.createIndex('timestamp', ['timestamp']);

      // Index pour les contenus
      await contentsCollection.createIndex('courseId_version', ['courseId', 'version']);
      await contentsCollection.createIndex('updatedAt', ['updatedAt']);

      console.log('Index créés avec succès');
    } catch (error) {
      console.error('Erreur lors de la création des index:', error);
    }
  }
}

module.exports = {
  client,
  AnalyticsService,
  LogService,
  ContentService,
  PerformanceService,
  Utils,
}; 
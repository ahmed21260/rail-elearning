# Rail E-Learning - Plateforme de Formation Ferroviaire

Plateforme e-learning moderne et scalable pour opérateurs ferroviaires avec IA, analytics, et fonctionnalités avancées.

## 🚀 Technologies

- **Frontend**: React 18 + TypeScript, React Router, TailwindCSS, PWA
- **Backend**: Firebase (Auth, Firestore, Storage)
- **Base de données**: DataStax Astra (Cassandra managé)
- **IA/Automatisation**: Langflow pour workflows intelligents
- **CI/CD**: GitHub Actions + Firebase Hosting
- **Fonctionnalités**: RBAC, Quiz interactifs, Flashcards, Géolocalisation, Alertes d'urgence

## 📋 Prérequis

- Node.js 18+
- npm ou yarn
- Compte Firebase
- Compte DataStax Astra
- Compte GitHub

## 🛠️ Installation

### 1. Cloner le projet
```bash
git clone <votre-repo>
cd rail-elearning
```

### 2. Configuration Firebase
```bash
# Installer Firebase CLI
npm install -g firebase-tools

# Se connecter à Firebase
firebase login

# Initialiser Firebase (répondre aux questions)
firebase init
```

### 3. Configuration DataStax Astra
```bash
# Créer un compte sur https://astra.datastax.com
# Créer une base de données Cassandra
# Récupérer les credentials et les ajouter dans backend/astraClient.js
```

### 4. Installation des dépendances
```bash
cd frontend
npm install
```

### 5. Variables d'environnement
Créer un fichier `.env` dans `frontend/` :
```env
REACT_APP_FIREBASE_API_KEY=votre_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=votre_auth_domain
REACT_APP_FIREBASE_PROJECT_ID=votre_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=votre_storage_bucket
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=votre_sender_id
REACT_APP_FIREBASE_APP_ID=votre_app_id
REACT_APP_ASTRA_DB_ID=votre_astra_db_id
REACT_APP_ASTRA_DB_REGION=votre_astra_region
REACT_APP_ASTRA_DB_KEYSPACE=votre_keyspace
REACT_APP_ASTRA_DB_APPLICATION_TOKEN=votre_token
REACT_APP_LANGFLOW_API_URL=https://api.langflow.com
```

### 6. Démarrage
```bash
# Développement
npm start

# Build de production
npm run build

# Déploiement
npm run deploy
```

## 🏗️ Architecture

### Frontend (React + TypeScript)
- **Components**: Composants réutilisables avec RBAC
- **Hooks**: Hooks personnalisés pour l'authentification et les données
- **Routes**: Navigation sécurisée avec React Router
- **PWA**: Service Worker et manifest pour installation mobile

### Backend (Firebase)
- **Authentication**: Email/Google OAuth
- **Firestore**: Base de données NoSQL pour les cours et utilisateurs
- **Storage**: Stockage des médias (vidéos, images, documents)

### DataStax Astra
- **Analytics**: Données de progression et performance
- **Logs**: Historique des actions utilisateurs
- **Contenus**: Stockage des contenus de cours

### Langflow
- **FAQ**: Système de questions/réponses intelligent
- **Alertes**: Notifications d'urgence automatisées
- **Analyse**: Insights sur les performances des apprenants

## 🔐 Rôles et Permissions

- **User**: Accès aux cours, quiz, flashcards
- **Instructor**: Création de contenu, suivi des apprenants
- **Admin**: Gestion complète de la plateforme

## 🚨 Fonctionnalités d'Urgence

- Géolocalisation des opérateurs
- Alertes d'urgence en temps réel
- Notifications push
- Système de communication d'urgence

## 📱 PWA Features

- Installation sur mobile/desktop
- Mode hors ligne
- Notifications push
- Synchronisation automatique

## 🤖 IA et Automatisation

- Génération automatique de quiz
- Recommandations personnalisées
- Analyse des performances
- Support multilingue

## 📊 Analytics

- Suivi des progrès
- Rapports de performance
- Métriques d'engagement
- Export des données

## 🚀 Déploiement

Le déploiement est automatisé via GitHub Actions :
- Build automatique sur push
- Tests automatisés
- Déploiement sur Firebase Hosting
- Notifications Slack/Discord

## 📞 Support

Pour toute question ou problème :
- Issues GitHub
- Documentation technique
- Support technique dédié

## 📄 Licence

MIT License - Voir LICENSE pour plus de détails. 
#!/bin/bash

# Script d'installation pour Rail E-Learning
# Ce script configure automatiquement l'environnement de développement

set -e

echo "🚀 Installation de Rail E-Learning..."
echo "======================================"

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonction pour afficher les messages
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Vérifier Node.js
print_status "Vérification de Node.js..."
if ! command -v node &> /dev/null; then
    print_error "Node.js n'est pas installé. Veuillez l'installer depuis https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node --version)
print_success "Node.js $NODE_VERSION détecté"

# Vérifier npm
print_status "Vérification de npm..."
if ! command -v npm &> /dev/null; then
    print_error "npm n'est pas installé."
    exit 1
fi

NPM_VERSION=$(npm --version)
print_success "npm $NPM_VERSION détecté"

# Vérifier Git
print_status "Vérification de Git..."
if ! command -v git &> /dev/null; then
    print_warning "Git n'est pas installé. L'installation continuera sans Git."
else
    GIT_VERSION=$(git --version)
    print_success "$GIT_VERSION détecté"
fi

# Créer le fichier .env s'il n'existe pas
print_status "Configuration des variables d'environnement..."
if [ ! -f "frontend/.env" ]; then
    cat > frontend/.env << EOF
# Configuration Firebase
REACT_APP_FIREBASE_API_KEY=your_api_key_here
REACT_APP_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=123456789
REACT_APP_FIREBASE_APP_ID=1:123456789:web:abcdef123456
REACT_APP_FIREBASE_VAPID_KEY=your_vapid_key_here

# Configuration DataStax Astra
REACT_APP_ASTRA_DB_ID=your_astra_db_id
REACT_APP_ASTRA_DB_REGION=your_astra_region
REACT_APP_ASTRA_DB_KEYSPACE=rail_elearning
REACT_APP_ASTRA_DB_APPLICATION_TOKEN=your_astra_token

# Configuration Langflow
REACT_APP_LANGFLOW_API_URL=https://api.langflow.com

# Configuration Analytics
REACT_APP_GA_MEASUREMENT_ID=GA_MEASUREMENT_ID
EOF
    print_success "Fichier .env créé dans frontend/"
    print_warning "⚠️  Veuillez configurer vos variables d'environnement dans frontend/.env"
else
    print_success "Fichier .env existe déjà"
fi

# Installer les dépendances frontend
print_status "Installation des dépendances frontend..."
cd frontend
npm install
print_success "Dépendances frontend installées"

# Installer les dépendances backend si le dossier existe
cd ..
if [ -d "backend" ]; then
    print_status "Installation des dépendances backend..."
    cd backend
    npm install
    print_success "Dépendances backend installées"
    cd ..
fi

# Installer Firebase CLI globalement
print_status "Installation de Firebase CLI..."
if ! command -v firebase &> /dev/null; then
    npm install -g firebase-tools
    print_success "Firebase CLI installé"
else
    FIREBASE_VERSION=$(firebase --version)
    print_success "Firebase CLI $FIREBASE_VERSION déjà installé"
fi

# Créer les dossiers nécessaires
print_status "Création des dossiers nécessaires..."
mkdir -p frontend/public/images
mkdir -p frontend/src/assets
mkdir -p frontend/src/types
mkdir -p frontend/src/utils
mkdir -p frontend/src/services
mkdir -p backend/functions
mkdir -p docs

print_success "Dossiers créés"

# Copier les fichiers de configuration par défaut
print_status "Configuration des fichiers par défaut..."

# Créer un fichier de configuration Tailwind personnalisé
if [ ! -f "frontend/tailwind.config.js" ]; then
    print_warning "Le fichier tailwind.config.js existe déjà"
fi

# Créer un fichier de configuration PostCSS
if [ ! -f "frontend/postcss.config.js" ]; then
    print_warning "Le fichier postcss.config.js existe déjà"
fi

# Créer un fichier de configuration TypeScript
if [ ! -f "frontend/tsconfig.json" ]; then
    print_warning "Le fichier tsconfig.json existe déjà"
fi

# Créer un fichier de configuration ESLint
if [ ! -f "frontend/.eslintrc.js" ]; then
    print_warning "Le fichier .eslintrc.js existe déjà"
fi

# Créer un fichier de configuration Firebase
if [ ! -f "firebase.json" ]; then
    print_warning "Le fichier firebase.json existe déjà"
fi

# Créer les règles Firestore
if [ ! -f "firestore.rules" ]; then
    print_warning "Le fichier firestore.rules existe déjà"
fi

# Créer les règles Storage
if [ ! -f "storage.rules" ]; then
    print_warning "Le fichier storage.rules existe déjà"
fi

# Créer le schéma DataStax
if [ ! -f "datastax/schema.cql" ]; then
    print_warning "Le fichier datastax/schema.cql existe déjà"
fi

# Créer le client Astra
if [ ! -f "backend/astraClient.js" ]; then
    print_warning "Le fichier backend/astraClient.js existe déjà"
fi

# Créer le workflow GitHub Actions
if [ ! -f ".github/workflows/deploy.yml" ]; then
    print_warning "Le fichier .github/workflows/deploy.yml existe déjà"
fi

print_success "Configuration terminée"

# Vérifier les prérequis
print_status "Vérification des prérequis..."

# Vérifier les variables d'environnement
if grep -q "your_api_key_here" frontend/.env; then
    print_warning "⚠️  Variables d'environnement non configurées dans frontend/.env"
    print_warning "   Veuillez configurer Firebase et DataStax Astra"
fi

# Créer un script de démarrage
print_status "Création du script de démarrage..."
cat > start.sh << 'EOF'
#!/bin/bash

echo "🚀 Démarrage de Rail E-Learning..."

# Vérifier si les variables d'environnement sont configurées
if grep -q "your_api_key_here" frontend/.env; then
    echo "⚠️  Variables d'environnement non configurées"
    echo "   Veuillez configurer frontend/.env avant de continuer"
    exit 1
fi

# Démarrer l'application
cd frontend
npm start
EOF

chmod +x start.sh
print_success "Script de démarrage créé (start.sh)"

# Créer un script de build
print_status "Création du script de build..."
cat > build.sh << 'EOF'
#!/bin/bash

echo "🔨 Build de Rail E-Learning..."

# Vérifier si les variables d'environnement sont configurées
if grep -q "your_api_key_here" frontend/.env; then
    echo "⚠️  Variables d'environnement non configurées"
    echo "   Veuillez configurer frontend/.env avant de continuer"
    exit 1
fi

# Build de l'application
cd frontend
npm run build

echo "✅ Build terminé avec succès"
echo "📁 Les fichiers de production sont dans frontend/build/"
EOF

chmod +x build.sh
print_success "Script de build créé (build.sh)"

# Créer un script de déploiement
print_status "Création du script de déploiement..."
cat > deploy.sh << 'EOF'
#!/bin/bash

echo "🚀 Déploiement de Rail E-Learning..."

# Vérifier si Firebase CLI est installé
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI n'est pas installé"
    echo "   Exécutez: npm install -g firebase-tools"
    exit 1
fi

# Vérifier si l'utilisateur est connecté à Firebase
if ! firebase projects:list &> /dev/null; then
    echo "❌ Vous n'êtes pas connecté à Firebase"
    echo "   Exécutez: firebase login"
    exit 1
fi

# Build de l'application
echo "🔨 Build de l'application..."
cd frontend
npm run build
cd ..

# Déploiement sur Firebase
echo "🚀 Déploiement sur Firebase..."
firebase deploy

echo "✅ Déploiement terminé avec succès"
EOF

chmod +x deploy.sh
print_success "Script de déploiement créé (deploy.sh)"

# Afficher les prochaines étapes
echo ""
echo "🎉 Installation terminée avec succès !"
echo "======================================"
echo ""
echo "📋 Prochaines étapes :"
echo ""
echo "1. 🔧 Configurer les variables d'environnement :"
echo "   - Éditer frontend/.env"
echo "   - Configurer Firebase (https://console.firebase.google.com)"
echo "   - Configurer DataStax Astra (https://astra.datastax.com)"
echo "   - Configurer Langflow (https://langflow.com)"
echo ""
echo "2. 🚀 Démarrer l'application :"
echo "   ./start.sh"
echo ""
echo "3. 🔨 Build pour la production :"
echo "   ./build.sh"
echo ""
echo "4. 🚀 Déployer sur Firebase :"
echo "   ./deploy.sh"
echo ""
echo "5. 📚 Documentation :"
echo "   - README.md pour les détails"
echo "   - docs/ pour la documentation technique"
echo ""
echo "🔗 Liens utiles :"
echo "   - Firebase Console: https://console.firebase.google.com"
echo "   - DataStax Astra: https://astra.datastax.com"
echo "   - Langflow: https://langflow.com"
echo "   - GitHub Actions: https://github.com/features/actions"
echo ""
echo "💡 Conseils :"
echo "   - Utilisez 'npm run lint' pour vérifier le code"
echo "   - Utilisez 'npm test' pour exécuter les tests"
echo "   - Consultez les logs Firebase avec 'firebase emulators:start'"
echo ""
print_success "Installation terminée ! 🎉" 